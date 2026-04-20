import { Component } from '@angular/core';
import { PosStore } from '../../store/pos.store';

@Component({
  selector: 'app-category-tabs',
  imports: [],
  templateUrl: './category-tabs.html',
  styleUrl: './category-tabs.scss',
})
export class CategoryTabs {
  categories = [
    'All',
    'Breakfast',
    'Lunch',
    'Dinner',
    'Desserts',
    'soup',
    'Beverages',
    'Appetizer',
  ];

  constructor(public store: PosStore) {}

  select(category: string) {
    this.store.selectedCategory.set(category);
  }
}
