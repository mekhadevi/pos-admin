import { trigger, transition, style, animate, query, stagger } from '@angular/animations';

export const loginAnimations = [
  // The main glass card popping into view
  trigger('cardReveal', [
    transition(':enter', [
      style({ opacity: 0, transform: 'scale(0.8) translateY(40px)' }),
      animate(
        '800ms cubic-bezier(0.34, 1.56, 0.64, 1)',
        style({ opacity: 1, transform: 'scale(1) translateY(0)' }),
      ),
    ]),
  ]),

  // The buttons and text sliding up one by one
  trigger('staggerFade', [
    transition(':enter', [
      query(
        '.animate-item',
        [
          style({ opacity: 0, transform: 'translateY(20px)' }),
          stagger('150ms', [
            animate('600ms ease-out', style({ opacity: 1, transform: 'translateY(0)' })),
          ]),
        ],
        { optional: true },
      ),
    ]),
  ]),
];
