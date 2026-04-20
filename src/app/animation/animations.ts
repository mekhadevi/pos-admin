import { trigger, transition, style, animate, query, stagger } from '@angular/animations';

export const restoeAnimations = [
  trigger('listAnimation', [
    transition('* <=> *', [
      query(
        ':enter',
        [
          style({ opacity: 0, transform: 'translateY(20px) scale(0.9)' }),
          stagger('60ms', [
            animate(
              '400ms cubic-bezier(0.35, 0, 0.25, 1)',
              style({ opacity: 1, transform: 'translateY(0) scale(1)' }),
            ),
          ]),
        ],
        { optional: true },
      ),
    ]),
  ]),
  trigger('slideInRight', [
    transition(':enter', [
      style({ transform: 'translateX(100%)', opacity: 0 }),
      animate('500ms ease-out', style({ transform: 'translateX(0)', opacity: 1 })),
    ]),
  ]),
];
