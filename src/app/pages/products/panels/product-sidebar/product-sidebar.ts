import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { ProductView } from '../../product.models';

@Component({
  selector: 'app-product-sidebar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './product-sidebar.html',
  styleUrl: './product-sidebar.scss',
})
export class ProductSidebar {
  @Input() view: ProductView = 'list';
  @Input() lowStockCount = 0;
  @Output() viewChange = new EventEmitter<ProductView>();
  go(v: ProductView) {
    this.viewChange.emit(v);
  }
}
