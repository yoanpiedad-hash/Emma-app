-- 23/11 (Paso 2, catálogo web): Mabel (función con la clave de servicio) aparta las prendas del pedido web con mover_stock.
-- mover_stock usa funciones del esquema privado (es_miembro, stock_num) y el rol service_role no tenía permiso de uso
-- sobre ese esquema: "permission denied for schema privado". La clave de servicio ya puede todo en las tablas; esto solo
-- le deja llamar a esas funciones. Probado en emma-prueba el 23/11. En la base real: solo con ok de Yoan.
grant usage on schema privado to service_role;
grant execute on function privado.stock_num(jsonb) to service_role;
