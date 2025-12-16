import { Component } from '@angular/core';
// Se mantiene tu importación original de Ionic
import { IonApp, IonRouterOutlet } from '@ionic/angular/standalone';

// ¡AQUÍ EMPIEZA LA SOLUCIÓN!
import { registerLocaleData } from '@angular/common';
import localeEs from '@angular/common/locales/es'; // 1. Importar los datos del idioma español

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.css'],
  standalone: true,
  // Se mantienen tus imports originales
  imports: [IonApp, IonRouterOutlet],
})
export class AppComponent {
  constructor() {
    // 2. Registrar los datos del idioma para que Angular pueda usarlos
    registerLocaleData(localeEs, 'es');
  }
}


