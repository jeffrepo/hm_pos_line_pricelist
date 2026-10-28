# HM — Listas de precios por línea en POS

Módulo para **Odoo 18.0**, Community y Enterprise. Añade **Tarifa de línea** en
las acciones de la pantalla del POS. Depende de `point_of_sale`; se puede
instalar independientemente de `hm_sale_line_pricelist` y de las remisiones.

## Instalación

1. Clonar el repositorio como `hm_pos_line_pricelist` dentro de una carpeta
   incluida en `addons_path`.
2. Reiniciar Odoo, actualizar aplicaciones e instalar
   **HM - Listas de precios por línea en POS**. Quitar el filtro «Aplicaciones».
3. Activar las listas de precios flexibles en la configuración del punto de
   venta y agregar las listas permitidas en **Disponibles**.
4. Recargar completamente el POS para cargar los campos y recursos nuevos.

```sh
git clone https://github.com/jeffrepo/hm_pos_line_pricelist.git
odoo-bin -d BASE -i hm_pos_line_pricelist --stop-after-init
```

Para actualizar, utilizar `-u hm_pos_line_pricelist` y recargar el POS. Antes de
actualizar una sesión en uso, sincronizar sus pedidos pendientes.

## Uso

1. Seleccionar un renglón del pedido.
2. Abrir **Acciones → Tarifa de línea**.
3. Elegir una lista. El diálogo identifica el producto al que se aplica.

La etiqueta **Tarifa: …** aparece en la línea, el recibo y la pantalla del
cliente. Elegir **Usar lista del pedido** elimina la selección específica.
El botón nativo de listas de precios sigue administrando la tarifa del pedido.

### Comportamiento

- Se muestran únicamente listas disponibles en la caja con la moneda del pedido.
- Se utiliza el motor de precios del POS, con sus reglas, fechas, cantidades,
  fórmulas, listas basadas en otras listas y atributos.
- Cambiar la cantidad o la lista general conserva la tarifa elegida en la línea.
- Las líneas con tarifa explícita permanecen separadas, incluso si el producto
  y el precio coinciden. Esto conserva la intención de cada selección.
- En productos con lotes, las cantidades se agrupan por producto, tarifa y
  sobreprecio de atributos; una tarifa diferente no altera su tramo de cantidad.
- Elegir una tarifa reemplaza un precio manual. Los descuentos porcentuales
  escritos por el cajero se conservan. Un precio manual posterior permanece
  manual hasta volver a elegir una tarifa.
- Los combos se tarifican desde su producto principal. Seleccionar un componente
  abre la tarifa del combo; Odoo distribuye el importe entre sus componentes.
- Devoluciones y líneas automáticas (por ejemplo, recompensas) conservan sus
  precios originales. Las devoluciones mantienen la referencia a la tarifa.
- El campo `pos.order.line.line_pricelist_id` queda almacenado y se carga con
  los pedidos. El POS utiliza su serialización normal para guardar localmente
  y sincronizar. El cálculo no hace llamadas al servidor: requiere haber cargado
  previamente los productos y listas para trabajar sin conexión.
- El formulario administrativo del pedido muestra la tarifa como información
  de consulta; la selección se realiza en la caja.

Se usan los permisos nativos de caja y listas de precios; no se añade una
autorización especial de supervisor. Las validaciones del servidor comprueban
la lista permitida, compañía y moneda. El módulo no integra la selección con
otros conectores de terceros o con la importación de pedidos de Ventas al POS.

## Pruebas

En una base de pruebas con Chrome/Chromium disponible para el recorrido web:

```sh
odoo-bin -d PRUEBAS -i hm_pos_line_pricelist --test-enable \
  --test-tags /hm_pos_line_pricelist --stop-after-init
```

Incluye pruebas de persistencia, campos cargados, validaciones, devoluciones y
ventas cerradas. El recorrido de navegador prueba el botón real, etiquetas,
cantidades, cambios globales, restablecimiento, precios manuales, separación de
líneas, lotes, serialización, sincronización y recuperación tras recargar.
GitHub Actions ejecuta la suite con Odoo 18, PostgreSQL 16 y Chrome.

Licencia: LGPL-3.
