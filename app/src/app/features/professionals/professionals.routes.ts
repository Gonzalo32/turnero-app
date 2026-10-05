import { Routes } from '@angular/router';

export const PROFESSIONALS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./components/professionals-list/professionals-list.component').then(
        m => m.ProfessionalsListComponent
      )
  }
];
