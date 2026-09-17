import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { PrintTemplateComponent } from './features/patient-form/components/print-template/print-template.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, PrintTemplateComponent],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {
  title = 'totem-app';
}
