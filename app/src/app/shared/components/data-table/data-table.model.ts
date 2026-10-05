/**
 * Definición de columnas y acciones para el componente reutilizable DataTable.
 */
export interface TableColumn<T = any> {
  /** Clave de la propiedad en el objeto de datos (o nombre de accessor) */
  key: string;
  /** Título a mostrar en la cabecera */
  header: string;
  /** Ancho opcional de la columna (ej: '80px', '25%') */
  width?: string;
  /** Alineación del contenido */
  align?: 'left' | 'center' | 'right';
  /** Tipo de renderizado */
  type?: 'text' | 'badge' | 'avatar' | 'date';
  /** Clase CSS dinámica para badges (ej: 'badge-success', 'badge-warning') */
  badgeClass?: (value: any, row: T) => string;
  /** Función opcional para formatear el valor a texto */
  format?: (value: any, row: T) => string;
}

export interface TableAction<T = any> {
  id: string;
  label?: string;
  icon?: 'edit' | 'delete' | 'view' | string;
  variant?: 'primary' | 'danger' | 'neutral';
}
