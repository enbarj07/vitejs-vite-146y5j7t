import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import { Html5Qrcode } from 'html5-qrcode';

interface ScannerProps {
  onScan: (codigo: string) => void;
  onClose?: () => void;
}

const SCANNER_ELEMENT_ID = 'trazabilidad-hu-reader';

export default function Scanner({
  onScan,
  onClose,
}: ScannerProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const procesandoResultadoRef = useRef(false);
  const montadoRef = useRef(true);

  const [iniciando, setIniciando] = useState(true);
  const [activo, setActivo] = useState(false);
  const [error, setError] = useState('');
  const [permisoDenegado, setPermisoDenegado] =
    useState(false);

  useEffect(() => {
    montadoRef.current = true;

    const iniciarScanner = async () => {
      try {
        setIniciando(true);
        setError('');
        setPermisoDenegado(false);

        const scanner = new Html5Qrcode(
          SCANNER_ELEMENT_ID,
        );

        scannerRef.current = scanner;

        await scanner.start(
          {
            facingMode: {
              exact: 'environment',
            },
          },
          {
            fps: 10,
            qrbox: {
              width: 250,
              height: 150,
            },
            aspectRatio: 1.777778,
            disableFlip: false,
          },
                    (decodedText: string) => {
            if (
              procesandoResultadoRef.current
            ) {
              return;
            }

            const codigo = decodedText.trim();

            if (!codigo) {
              return;
            }

            procesandoResultadoRef.current = true;

            try {
              onScan(codigo);
            } finally {
              window.setTimeout(() => {
                procesandoResultadoRef.current =
                  false;
              }, 1000);
            }
          },
                    () => {
            /*
             * Los errores de lectura son normales mientras
             * la cámara está buscando un código.
             *
             * No se muestran como error para evitar que la
             * pantalla parpadee continuamente.
             */
          },
        );

        if (!montadoRef.current) {
          try {
            await scanner.stop();
            scanner.clear();
          } catch {
            // El componente ya fue desmontado.
          }

          return;
        }

        setActivo(true);
      } catch (errorInicial) {
        console.error(
          'Error al iniciar el escáner:',
          errorInicial,
        );

        if (!montadoRef.current) {
          return;
        }

        const mensaje = obtenerMensajeError(
          errorInicial,
        );

        setError(mensaje);

        if (
          esErrorPermisoCamara(errorInicial)
        ) {
          setPermisoDenegado(true);
        }

        setActivo(false);
      } finally {
        if (montadoRef.current) {
          setIniciando(false);
        }
      }
    };

    void iniciarScanner();

    return () => {
      montadoRef.current = false;

      const scanner = scannerRef.current;

      scannerRef.current = null;

      if (scanner) {
        void detenerScanner(scanner);
      }
    };
  }, [onScan]);

  const cerrarScanner = async () => {
    const scanner = scannerRef.current;

    scannerRef.current = null;

    if (scanner) {
      await detenerScanner(scanner);
    }

    if (onClose) {
      onClose();
    }
  };

  const reintentar = async () => {
    setError('');
    setPermisoDenegado(false);
    setIniciando(true);

    const scannerAnterior = scannerRef.current;

    if (scannerAnterior) {
      await detenerScanner(scannerAnterior);
      scannerRef.current = null;
    }

    window.location.reload();
  };

  return (
    <div style={styles.container}>
      <div style={styles.instructions}>
        <div style={styles.instructionIcon}>
          ▣
        </div>

        <div>
          <strong style={styles.instructionTitle}>
            Escanea la HU
          </strong>

          <p style={styles.instructionText}>
            Coloca el código de barras o QR dentro del
            recuadro. Mantén el teléfono estable y con
            suficiente iluminación.
          </p>
        </div>
      </div>

      <div style={styles.scannerWrapper}>
        <div
          id={SCANNER_ELEMENT_ID}
          style={styles.scanner}
        />

        {iniciando && (
          <div style={styles.overlay}>
            <div style={styles.spinner} />

            <strong>
              Iniciando cámara...
            </strong>

            <span>
              Solicita permiso para utilizar la cámara.
            </span>
          </div>
        )}

        {!iniciando && !activo && (
          <div style={styles.overlay}>
            <div style={styles.cameraIcon}>
              ▣
            </div>

            <strong>
              Cámara no disponible
            </strong>

            <span>
              {error ||
                'No fue posible iniciar el escáner.'}
            </span>
          </div>
        )}
      </div>

      {activo && (
        <div style={styles.status}>
          <span style={styles.statusDot} />

          Cámara activa · Buscando código...
        </div>
      )}

      {error && (
        <div style={styles.errorBox}>
          <strong>
            No se pudo activar la cámara
          </strong>

          <p style={styles.errorText}>
            {error}
          </p>

          {permisoDenegado && (
            <p style={styles.permissionText}>
              Revisa los permisos de cámara del navegador
              para este sitio y vuelve a intentarlo.
            </p>
          )}

          <button
            type="button"
            style={styles.retryButton}
            onClick={reintentar}
          >
            Reintentar
          </button>
        </div>
      )}

      <div style={styles.footer}>
        <button
          type="button"
          style={styles.cancelButton}
          onClick={() => {
            void cerrarScanner();
          }}
        >
          Cerrar escáner
        </button>

        <span style={styles.secureText}>
          La lectura se procesa localmente.
        </span>
      </div>
    </div>
  );
}

async function detenerScanner(
  scanner: Html5Qrcode,
): Promise<void> {
  try {
    if (scanner.isScanning) {
      await scanner.stop();
    }
  } catch (error) {
    console.warn(
      'No fue posible detener la cámara:',
      error,
    );
  }

  try {
    scanner.clear();
  } catch (error) {
    console.warn(
      'No fue posible limpiar el escáner:',
      error,
    );
  }
}

function obtenerMensajeError(
  error: unknown,
): string {
  if (error instanceof DOMException) {
    if (error.name === 'NotAllowedError') {
      return 'El navegador no tiene permiso para utilizar la cámara.';
    }

    if (error.name === 'NotFoundError') {
      return 'No se encontró una cámara disponible en este dispositivo.';
    }

    if (error.name === 'NotReadableError') {
      return 'La cámara está siendo utilizada por otra aplicación o no puede ser leída.';
    }

    if (error.name === 'SecurityError') {
      return 'El navegador bloqueó el acceso a la cámara por motivos de seguridad.';
    }
  }

  if (error instanceof Error) {
    const mensaje = error.message.toLowerCase();

    if (
      mensaje.includes('permission') ||
      mensaje.includes('notallowed') ||
      mensaje.includes('denied')
    ) {
      return 'El acceso a la cámara fue rechazado. Revisa los permisos del navegador.';
    }

    if (
      mensaje.includes('camera') &&
      mensaje.includes('not found')
    ) {
      return 'No se encontró una cámara disponible.';
    }

    if (error.message.trim()) {
      return error.message;
    }
  }

  return 'No fue posible iniciar la cámara. Verifica que el navegador tenga acceso a ella.';
}

function esErrorPermisoCamara(
  error: unknown,
): boolean {
  if (error instanceof DOMException) {
    return (
      error.name === 'NotAllowedError' ||
      error.name === 'SecurityError'
    );
  }

  if (error instanceof Error) {
    const mensaje = error.message.toLowerCase();

    return (
      mensaje.includes('permission') ||
      mensaje.includes('notallowed') ||
      mensaje.includes('denied')
    );
  }

  return false;
}

const styles: Record<string, CSSProperties> = {
  container: {
    width: '100%',
  },

  instructions: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '10px',
    marginBottom: '12px',
    padding: '12px',
    borderRadius: '9px',
    background: '#f8fafc',
    border: '1px solid #e2e8f0',
  },

  instructionIcon: {
    width: '34px',
    height: '34px',
    flex: '0 0 auto',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '8px',
    background: '#ecfdf5',
    color: '#0b5d3b',
    fontSize: '20px',
    fontWeight: 800,
  },

  instructionTitle: {
    display: 'block',
    color: '#1e293b',
    fontSize: '13px',
  },

  instructionText: {
    margin: '3px 0 0',
    color: '#64748b',
    fontSize: '12px',
    lineHeight: 1.45,
  },

  scannerWrapper: {
    position: 'relative',
    width: '100%',
    minHeight: '320px',
    overflow: 'hidden',
    borderRadius: '12px',
    background: '#0f172a',
    border: '1px solid #1e293b',
  },

  scanner: {
    width: '100%',
    minHeight: '320px',
  },

  overlay: {
    position: 'absolute',
    inset: 0,
    zIndex: 5,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    gap: '10px',
    padding: '24px',
    background: 'rgba(15, 23, 42, 0.92)',
    color: '#ffffff',
    textAlign: 'center',
  },

  spinner: {
    width: '34px',
    height: '34px',
    border: '4px solid rgba(255, 255, 255, 0.3)',
    borderTopColor: '#ffffff',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },

  cameraIcon: {
    width: '56px',
    height: '56px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '14px',
    background: '#334155',
    color: '#ffffff',
    fontSize: '28px',
  },

  status: {
    marginTop: '10px',
    padding: '9px 11px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '7px',
    borderRadius: '8px',
    background: '#f0fdf4',
    color: '#166534',
    fontSize: '12px',
    fontWeight: 700,
  },

  statusDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    background: '#16a34a',
    boxShadow: '0 0 0 3px rgba(22, 163, 74, 0.15)',
  },

  errorBox: {
    marginTop: '12px',
    padding: '13px',
    borderRadius: '9px',
    border: '1px solid #fecaca',
    background: '#fef2f2',
    color: '#991b1b',
    fontSize: '13px',
  },

  errorText: {
    margin: '5px 0 0',
    lineHeight: 1.45,
  },

  permissionText: {
    margin: '8px 0 0',
    color: '#7f1d1d',
    fontSize: '12px',
    lineHeight: 1.45,
  },

  retryButton: {
    marginTop: '10px',
    minHeight: '40px',
    padding: '9px 13px',
    border: '1px solid #b91c1c',
    borderRadius: '8px',
    background: '#ffffff',
    color: '#991b1b',
    fontWeight: 800,
  },

  footer: {
    marginTop: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '10px',
    flexWrap: 'wrap',
  },

  cancelButton: {
    minHeight: '42px',
    padding: '10px 15px',
    border: '1px solid #cbd5e1',
    borderRadius: '8px',
    background: '#ffffff',
    color: '#334155',
    fontWeight: 700,
  },

  secureText: {
    color: '#94a3b8',
    fontSize: '11px',
  },
};
