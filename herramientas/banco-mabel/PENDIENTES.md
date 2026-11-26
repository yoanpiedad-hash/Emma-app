# Pendientes del banco de Mabel

## R05 · pendiente abierto sin motivo claro (26/11, a investigar, no frena publicaciones)
- Banco completo, vuelta 1 de 3 (Mabel v119, commit ef3db4b): R05 dio "dejó pendiente para Yanaina y no tenía".
- Mabel contestó bien ("La cadetería a domicilio en Montevideo sale $250") y el registro del turno dice herramientas = [] (no llamó pasar_a_yanaina).
- El pendiente abierto tenía `ultimo` = 03:19:00Z, un segundo antes de que se guardara el turno: alguien lo escribió durante el repaso, no fue el modelo.
- Vueltas 2 y 3 y tres corridas sueltas de R01-R05: todo bien. No se pudo reproducir.
- Sospechas a mirar: registrarDerivado reabriendo la fila "equipo respondió" (cambia `ultimo` y borra `resuelto`) desde algún camino del repaso
  (sinResp con pendiente abierto, "Escribió después del pase"); o una carrera con el arreglo del banco (upsert del derivado de prueba).
- Para la próxima: que el banco guarde `motivos` del pendiente (no solo `ultimo`) para ver qué texto lo reabrió.
