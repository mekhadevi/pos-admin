import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { Product } from '../../product.models';

@Component({
  selector: 'app-low-stock-alerts',
  imports: [CommonModule],
  templateUrl: './low-stock-alerts.html',
  styleUrl: './low-stock-alerts.scss',
})
export class LowStockAlerts {
  @Input() products: Product[] = [];
  get lowList() {
    return this.products.filter((p) => p.StockQty <= (p.LowStockThreshold || 10));
  }
}
