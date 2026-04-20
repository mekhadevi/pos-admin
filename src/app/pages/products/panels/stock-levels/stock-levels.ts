import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Product } from '../../product.models';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import {
  Component as Comp1,
  Input as In1,
  Output as Out1,
  EventEmitter as Ev1,
} from '@angular/core';

@Component({
  selector: 'app-stock-levels',
  imports: [CommonModule, FormsModule],
  templateUrl: './stock-levels.html',
  styleUrl: './stock-levels.scss',
})
export class StockLevels {
  @Input() products: Product[] = [];
  @Output() adjustStock = new EventEmitter<{ id: number; qty: number; note: string }>();
  target: Product | null = null;
  adjQty = 0;
  adjNote = '';
  qtyColor(p: Product) {
    if (p.StockQty <= 0) return '#E24B4A';
    if (p.StockQty < (p.LowStockThreshold || 10)) return '#EF9F27';
    return '#3dba8a';
  }
  prompt(p: Product) {
    this.target = p;
    this.adjQty = 0;
    this.adjNote = '';
  }
  doAdj() {
    this.adjustStock.emit({ id: this.target!.Id, qty: this.adjQty, note: this.adjNote });
    this.target = null;
  }
}
