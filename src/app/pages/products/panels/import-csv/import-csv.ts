import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-import-csv',
  imports: [CommonModule],
  templateUrl: './import-csv.html',
  styleUrl: './import-csv.scss',
})
export class ImportCsv {
  @Input() companyId = 1;
  @Output() imported = new EventEmitter<void>();

  preview: any[] = [];
  error = '';
  importing = false;
  done = false;
  importedCount = 0;

  onFileChange(event: Event) {
    this.error = '';
    this.preview = [];
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      this.preview = this.parseCSV(text);
    };
    reader.readAsText(file);
  }

  parseCSV(text: string): any[] {
    const lines = text
      .trim()
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length < 2) {
      this.error = 'CSV must have a header row and at least one data row.';
      return [];
    }
    const headers = lines[0].split(',').map((h) => h.trim());
    return lines.slice(1).map((line) => {
      const vals = line.split(',').map((v) => v.trim());
      const obj: any = {};
      headers.forEach((h, i) => (obj[h] = vals[i] ?? ''));
      return obj;
    });
  }

  async doImport() {
    if (!this.preview.length) return;
    this.importing = true;
    const result = await (window as any).electronAPI.products.importCSV(
      this.companyId,
      this.preview,
    );
    this.importing = false;
    if (result.success) {
      this.importedCount = result.imported;
      this.done = true;
      this.imported.emit();
    }
  }
}
