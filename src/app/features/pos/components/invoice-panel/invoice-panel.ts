import { Component } from '@angular/core';
import { PosStore } from '../../store/pos.store';
import { DatePipe, DecimalPipe } from '@angular/common'; // Import Pipes here
@Component({
  selector: 'app-invoice-panel',
  standalone: true,
  imports: [DatePipe, DecimalPipe],
  templateUrl: './invoice-panel.html',
  styleUrl: './invoice-panel.scss',
})
export class InvoicePanel {
  today = new Date();
  constructor(public store: PosStore) {}

  // invoice-panel.ts
  checkout() {
    const receipt = document.getElementById('print-receipt');
    if (!receipt) return;

    const html = receipt.innerHTML;

    // Open visible popup for print preview
    const printWindow = window.open('', '_blank', 'width=400,height=600,scrollbars=yes');
    if (!printWindow) {
      console.error('Popup blocked');
      return;
    }

    // Inject the receipt HTML
    printWindow.document.write(`
    <html>
      <head>
        <title>Receipt Preview</title>
        <style>
          body { font-family: monospace; width: 80mm; padding: 10px; }
          table { width:100%; border-collapse: collapse; }
          td, th { font-size:12px; padding:4px 0; }
          h1 { text-align:center; }
          hr { border: 1px dashed #000; }
        </style>
      </head>
      <body>
        ${html}
        <div style="text-align:center; margin-top:20px;">
          <button (click)="window.print()">Print</button>
        </div>
      </body>
    </html>
  `);

    printWindow.document.close();
    printWindow.focus();
  }
}
