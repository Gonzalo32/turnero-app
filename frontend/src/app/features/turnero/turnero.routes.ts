import { Routes } from '@angular/router';

export const TURNERO_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./components/turnero-tv/turnero-tv.component').then(m => m.TurneroTvComponent)
  }
];
