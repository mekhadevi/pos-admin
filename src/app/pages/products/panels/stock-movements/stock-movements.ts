import { Component, Input } from '@angular/core';
import { StockMovement } from '../../product.models';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-stock-movements',
  imports: [CommonModule],
  templateUrl: './stock-movements.html',
  styleUrl: './stock-movements.scss',
})
export class StockMovements {
  @Input() movements: StockMovement[] = [];
  typeClass(t: string) {
    return t.toLowerCase();
  }
}
