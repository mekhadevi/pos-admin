import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-weather-icon',
  imports: [CommonModule],
  templateUrl: './weather-icon.html',
  styleUrl: './weather-icon.scss',
})
export class WeatherIcon {
  @Input() type: string = 'sunny';
  @Input() size: string = '48px';
}
