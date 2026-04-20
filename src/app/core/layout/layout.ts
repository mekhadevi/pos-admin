import { Component } from '@angular/core';
import { Sidebar } from './sidebar/sidebar';
import { RouterOutlet } from '@angular/router';
import { Topbar } from './topbar/topbar';
import { PosStore } from '../../features/pos/store/pos.store';

@Component({
  selector: 'app-layout',
  imports: [RouterOutlet, Sidebar, Topbar],
  templateUrl: './layout.html',
  styleUrl: './layout.scss',
})
export class Layout {
  constructor(public store: PosStore) {}
}
