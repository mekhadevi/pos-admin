import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Category, Product } from '../../product.models';

@Component({
  selector: 'app-export',
  imports: [CommonModule, FormsModule],
  templateUrl: './export.html',
  styleUrl: './export.scss',
})
export class Export {
  @Input() products: Product[] = [];
  @Input() categories: Category[] = [];
  @Input() companyId = 1;
  format = 'CSV';
  selectedCategoryId: number | null = null;
  exporting = false;

  async doExport() {
    this.exporting = true;
    const result = await (window as any).electronAPI.products.exportAll(
      this.companyId,
      this.format,
      this.selectedCategoryId,
    );
    this.exporting = false;
    if (result.success) this.downloadCSV(result.rows);
  }

  downloadCSV(rows: any[]) {
    if (!rows.length) return;
    const headers = ['Name', 'CategoryName', 'Barcode', 'SKU', 'Price', 'VATRate', 'StockQty'];
    const lines = [
      headers.join(','),
      ...rows.map((r) => headers.map((h) => `"${r[h] ?? ''}"`).join(',')),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `products_export_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
}
