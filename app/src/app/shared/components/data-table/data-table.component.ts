import { Component, input, output, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TableColumn, TableAction } from './data-table.model';

/**
 * Componente de tabla reutilizable para todas las vistas del sistema.
 * Soporta búsqueda en tiempo real, badges, avatares, formateo dinámico y acciones.
 */
@Component({
  selector: 'app-data-table',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './data-table.component.html',
  styleUrl: './data-table.component.scss'
})
export class DataTableComponent<T = any> {
  /** Columnas a renderizar */
  readonly columns = input.required<TableColumn<T>[]>();

  /** Datos a mostrar */
  readonly data = input.required<T[]>();

  /** Habilitar barra de búsqueda rápida */
  readonly searchable = input<boolean>(true);

  /** Placeholder del buscador */
  readonly searchPlaceholder = input<string>('Buscar en la tabla...');

  /** Estado de carga */
  readonly loading = input<boolean>(false);

  /** Mensaje cuando no hay registros */
  readonly emptyMessage = input<string>('No se encontraron registros');

  /** Etiqueta para el conteo de elementos (ej: 'odontólogos') */
  readonly countLabel = input<string>('registros');

  /** Acciones por fila (opcional) */
  readonly actions = input<TableAction<T>[]>([]);

  /** Evento al hacer clic en una fila */
  readonly rowClick = output<T>();

  /** Evento al hacer clic en una acción */
  readonly actionClick = output<{ action: string; row: T }>();

  /** Texto del buscador */
  readonly searchTerm = signal<string>('');

  /** Datos filtrados por el término de búsqueda */
  readonly filteredData = computed(() => {
    const list = this.data();
    const query = this.searchTerm().trim().toLowerCase();

    if (!query) return list;

    return list.filter(item => {
      return Object.values(item as Record<string, any>).some(val => {
        if (val === null || val === undefined) return false;
        return String(val).toLowerCase().includes(query);
      });
    });
  });

  /** Extrae el valor de la columna para una fila */
  getCellValue(row: T, col: TableColumn<T>): string {
    const raw = (row as any)[col.key];
    if (col.format) {
      return col.format(raw, row);
    }
    return raw !== undefined && raw !== null ? String(raw) : '—';
  }

  /** Extrae la clase CSS del badge para una columna */
  getBadgeClass(row: T, col: TableColumn<T>): string {
    if (!col.badgeClass) return '';
    const raw = (row as any)[col.key];
    return col.badgeClass(raw, row);
  }

  /** Extrae las iniciales para columnas de tipo avatar */
  getAvatarInitials(row: T, col: TableColumn<T>): string {
    const value = this.getCellValue(row, col);
    if (!value || value === '—') return '?';
    const clean = value.replace(/[,.]/g, ' ').trim();
    const parts = clean.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return value.slice(0, 2).toUpperCase();
  }

  onRowClick(row: T): void {
    this.rowClick.emit(row);
  }

  onActionClick(action: string, row: T, event: MouseEvent): void {
    event.stopPropagation();
    this.actionClick.emit({ action, row });
  }
}
