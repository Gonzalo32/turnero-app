import { Routes } from '@angular/router';

export const QUEUE_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./components/queue-list/queue-list.component').then(m => m.QueueListComponent)
  }
];
