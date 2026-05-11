import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, EventEmitter, Input, Output } from '@angular/core';

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
  fileName = '';

  // FIX: inject ChangeDetectorRef properly — was declared as `cdr: any` (undefined)
  constructor(private cdr: ChangeDetectorRef) {}

  onFileChange(event: Event) {
    this.error = '';
    this.preview = [];
    this.done = false;
    this.importedCount = 0;
    this.fileName = '';

    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.csv')) {
      this.error = 'Please upload a .csv file.';
      this.cdr.detectChanges();
      return;
    }

    this.fileName = file.name;

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      this.preview = this.parseCSV(text);
      this.cdr.detectChanges(); // FIX: was crashing here because cdr was undefined
    };
    reader.onerror = () => {
      this.error = 'Failed to read file.';
      this.cdr.detectChanges();
    };
    reader.readAsText(file);
  }

  parseCSV(text: string): any[] {
    // Normalise line endings
    const lines = text
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .trim()
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);

    if (lines.length < 2) {
      this.error = 'CSV must have a header row and at least one data row.';
      return [];
    }

    const headers = lines[0].split(',').map((h) => h.trim());

    // Validate required columns
    if (!headers.includes('Name') || !headers.includes('Price')) {
      this.error = 'CSV must have at least Name and Price columns.';
      return [];
    }

    return lines.slice(1).map((line) => {
      const vals = line.split(',').map((v) => v.trim());
      const obj: any = {};
      headers.forEach((h, i) => (obj[h] = vals[i] ?? ''));
      return obj;
    });
  }

  get previewHeaders(): string[] {
    return this.preview.length ? Object.keys(this.preview[0]) : [];
  }

  async doImport() {
    if (!this.preview.length || this.importing) return;
    this.importing = true;
    this.error = '';

    try {
      const result = await (window as any).electronAPI.products.importCSV(
        this.companyId,
        this.preview,
      );

      if (result?.success) {
        this.importedCount = result.imported;
        this.done = true;
        this.preview = [];
        this.fileName = '';
        this.imported.emit();
      } else {
        this.error = result?.error ?? 'Import failed. Please check the CSV and try again.';
      }
    } catch (err: any) {
      console.error('doImport error:', err);
      this.error = err?.message ?? 'Unexpected error during import.';
    } finally {
      this.importing = false;
      this.cdr.detectChanges();
    }
  }

  reset() {
    this.preview = [];
    this.error = '';
    this.done = false;
    this.importedCount = 0;
    this.fileName = '';
    this.cdr.detectChanges();
  }
}
