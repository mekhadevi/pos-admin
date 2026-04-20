import { Component } from '@angular/core';
import { PosStore } from '../../../features/pos/store/pos.store';
import { FontAwesomeModule, FaIconLibrary } from '@fortawesome/angular-fontawesome';

@Component({
  selector: 'app-topbar',
  imports: [FontAwesomeModule],
  templateUrl: './topbar.html',
  styleUrl: './topbar.scss',
})
export class Topbar {
  constructor(public store: PosStore) {}
}
