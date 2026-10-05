import { useEffect, useState, type CSSProperties } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function BotonInstalar() {
  const [eventoInstalacion, setEventoInstalacion] =
    useState<BeforeInstallPromptEvent | null>(null);

  const [instalado, setInstalado] = useState(false);
  const [cerrado, setCerrado] = useState(false);

  useEffect(() => {
    const manejarBeforeInstall = (e: Event) => {
      e.preventDefault();
      setEventoInstalacion(e as BeforeInstallPromptEvent);
    };

    const manejarInstalado = () => {
      setInstalado(true);
      setEventoInstalacion(null);
    };

    window.addEventListener('beforeinstallprompt', manejarBeforeInstall);
    window.addEventListener('appinstalled', manejarInstalado);

    if (
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as { standalone?: boolean }).standalone === true
    ) {
      setInstalado(true);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', manejarBeforeInstall);
      window.removeEventListener('appinstalled', manejarInstalado);
    };
  }, []);

  const instalar = async () => {
    if (!eventoInstalacion) return;

    await eventoInstalacion.prompt();
    const resultado = await eventoInstalacion.userChoice;

    if (resultado.outcome === 'accepted') {
      setInstalado(true);
    }

    setEventoInstalacion(null);
  };

  if (instalado || cerrado || !eventoInstalacion) {
    return null;
  }

  return (
    <div style={styles.banner}>
      <div style={styles.texto}>
        <strong style={styles.titulo}>📱 Instala la app</strong>
        <span style={styles.subtitulo}>
          Acceso rápido desde tu pantalla de inicio
        </span>
      </div>

      <div style={styles.acciones}>
        <button
          type="button"
          onClick={instalar}
          style={styles.botonInstalar}
        >
          Instalar
        </button>

        <button
          type="button"
          onClick={() => setCerrado(true)}
          style={styles.botonCerrar}
          aria-label="Cerrar"
        >
          ×
        </button>
      </div>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  banner: {
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
    padding: '14px 16px',
    background: '#0b5d3b',
    color: '#ffffff',
    boxShadow: '0 -4px 16px rgba(15, 23, 42, 0.25)',
    flexWrap: 'wrap',
  },
  texto: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    minWidth: 0,
    flex: 1,
  },
  titulo: {
    fontSize: '15px',
  },
  subtitulo: {
    fontSize: '12px',
    opacity: 0.9,
  },
  acciones: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  botonInstalar: {
    minHeight: '40px',
    padding: '8px 16px',
    border: 'none',
    borderRadius: '8px',
    background: '#ffffff',
    color: '#0b5d3b',
    fontWeight: 800,
    fontSize: '14px',
    cursor: 'pointer',
  },
  botonCerrar: {
    width: '36px',
    height: '36px',
    padding: 0,
    border: '1px solid rgba(255,255,255,0.4)',
    borderRadius: '8px',
    background: 'transparent',
    color: '#ffffff',
    fontSize: '22px',
    lineHeight: 1,
    cursor: 'pointer',
  },
};
