# Trazabilidad HU

Aplicación web progresiva (PWA) para el control y trazabilidad de HU (Unidades de Manejo/Tarimas) en Bill Pack.

El sistema permite registrar el recorrido de cada HU desde su entrada hasta su salida, incluyendo tiempos de proceso, bricks dañados, reposiciones entre HU y observaciones del proceso.

---

## Información del sistema

- **Nombre:** Trazabilidad HU
- **Empresa:** Bill Pack
- **Código de documento:** REG-INO-013
- **Versión:** 01
- **Área:** Inocuidad / Producción / Embarques
- **Tipo:** Aplicación Web Progresiva (PWA)
- **Funcionamiento:** Offline-first
- **Base de datos local:** IndexedDB
- **Motor IndexedDB:** Dexie
- **Backend actual:** Ninguno
- **Backend futuro:** Cloudflare Workers + D1

---

## Propósito

Trazabilidad HU permite rastrear cada Unidad de Manejo (HU) durante el proceso productivo.

El sistema registra:

- Folio de producción.
- Cliente.
- Producto.
- Proceso.
- Turno.
- Encargado de línea.
- Línea o módulo.
- Supervisor.
- Inspector QA.
- Código de HU.
- Hora de entrada.
- Hora de salida.
- Duración del proceso.
- Cantidad de bricks dañados.
- Causa del daño.
- Código individual de bricks dañados.
- Reposición de bricks.
- HU de origen de la reposición.
- Cantidad tomada de otra HU.
- Verificación de la reposición.
- Observaciones.
- Estado de sincronización.

---

## Flujo de trazabilidad

El flujo principal es:

```text
HU afectada / destino
        │
        │
        ▼
      HU.C
        │
        │ bricks dañados
        │
        ▼
Reposición desde otra HU
        │
        ▼
      HU.B
        │
        │ cantidad tomada
        ▼
      HU.A
   HU de origen