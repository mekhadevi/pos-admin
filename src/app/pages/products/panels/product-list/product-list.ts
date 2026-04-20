import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Product } from '../../products';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-product-list',
  imports: [CommonModule, FormsModule],
  templateUrl: './product-list.html',
  styleUrl: './product-list.scss',
})
export class ProductList {
  @Input() products: Product[] = [];
  @Output() edit = new EventEmitter<Product>();
  @Output() delete = new EventEmitter<number>();
  @Output() adjustStock = new EventEmitter<{ id: number; qty: number; note: string }>();

  confirmId: number | null = null;
  confirmName = '';
  stockProduct!: Product;
  showStockModal = false;
  stockQty = 0;
  stockNote = '';

  stockClass(p: Product) {
    if (p.StockQty <= 0) return 's-out';
    if (p.StockQty < (p.LowStockThreshold || 10)) return 's-low';
    return 's-ok';
  }

  doDelete() {
    this.delete.emit(this.confirmId!);
    this.confirmId = null;
  }

  promptStock(p: Product) {
    this.stockProduct = p;
    this.stockQty = 0;
    this.stockNote = '';
    this.showStockModal = true;
  }

  doStock() {
    this.adjustStock.emit({ id: this.stockProduct.Id, qty: this.stockQty, note: this.stockNote });
    this.showStockModal = false;
  }
}
