import { Component } from '@angular/core';
import { PRODUCTS } from '../../data/products';
import { CommonModule } from '@angular/common';
import { CategoryTabs } from '../../components/category-tabs/category-tabs';
import { ProductCard } from '../../components/product-card/product-card';
import { InvoicePanel } from '../../components/invoice-panel/invoice-panel';
import { PosStore } from '../../store/pos.store';

@Component({
  selector: 'app-pos-dashboard',
  imports: [CommonModule, CategoryTabs, ProductCard, InvoicePanel],

  templateUrl: './pos-dashboard.html',
  styleUrl: './pos-dashboard.scss',
})
export class PosDashboard {
  constructor(public store: PosStore) {
    this.store.products.set(PRODUCTS);
  }
}
