import { Pipe, PipeTransform } from '@angular/core';

@Pipe({ name: 'pendingCount', standalone: true })
export class PendingCountPipe implements PipeTransform {
  transform(orders: any[]): number {
    return (orders || []).filter((o) => o.Status === 'pending').length;
  }
}
