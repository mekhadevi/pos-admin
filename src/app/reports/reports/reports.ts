import { Component, computed, signal } from '@angular/core';
import { ChartConfiguration, ChartData, ChartType } from 'chart.js';
import { BaseChartDirective } from 'ng2-charts';

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [BaseChartDirective],
  templateUrl: './reports.html',
  styleUrl: './reports.scss',
})
export class Reports {
  today = new Date().toDateString();

  // Summary Cards
  summaryCards = signal([
    {
      title: 'Total Sales',
      value: '$936',
      icon: 'fa-solid fa-dollar-sign',
      iconColor: '#0ea5e9', // Blue icon
      bgColor: '#e0f2fe', // Light blue background
    },
    {
      title: 'Total Purchases',
      value: '$67,789',
      icon: 'fa-solid fa-cart-shopping',
      iconColor: '#d946ef', // Pink/Purple icon
      bgColor: '#fce7f3',
    },
    {
      title: 'Sales Return',
      value: '123',
      icon: 'fa-solid fa-arrow-rotate-left',
      iconColor: '#22c55e', // Green icon
      bgColor: '#dcfce7',
    },
    {
      title: 'Purchase Return',
      value: '225',
      icon: 'fa-solid fa-box',
      iconColor: '#f59e0b', // Orange icon
      bgColor: '#ffedd5',
    },
  ]);

  viewMode = signal<'monthly' | 'quarterly' | 'yearly'>('monthly');

  setView(mode: 'monthly' | 'quarterly' | 'yearly') {
    this.viewMode.set(mode);
  }

  // DATA DEFINITIONS
  monthlySales: ChartData<'bar'> = {
    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    datasets: [
      {
        label: 'Income',
        data: [300, 450, 500, 700, 800, 600, 750, 820, 780, 850, 900, 950],
        backgroundColor: '#8b5cf6',
        borderRadius: 5,
        barThickness: 12,
      },
      {
        label: 'Expense',
        data: [420, 380, 400, 550, 450, 300, 400, 500, 650, 600, 300, 280],
        backgroundColor: '#ff80b2',
        borderRadius: 5,
        barThickness: 12,
      },
    ],
  };

  // Quarterly - Added second dataset for "Expense"
  quarterlySales: ChartData<'bar'> = {
    labels: ['Q1', 'Q2', 'Q3', 'Q4'],
    datasets: [
      {
        label: 'Income',
        data: [4500, 5200, 6100, 7000],
        backgroundColor: '#8b5cf6',
        borderRadius: 5,
        barThickness: 20,
      },
      {
        label: 'Expense',
        data: [3000, 4000, 5500, 6000],
        backgroundColor: '#ff80b2',
        borderRadius: 5,
        barThickness: 20,
      },
    ],
  };

  // Yearly - If you want double bars here too, keep it as 'bar' type
  // Note: Your earlier code switched this to 'line'. If you want double bars, use 'bar'.
  yearlySales: ChartData<'bar'> = {
    labels: ['2022', '2023', '2024', '2025'],
    datasets: [
      {
        label: 'Income',
        data: [20000, 25000, 30000, 35000],
        backgroundColor: '#8b5cf6',
        borderRadius: 5,
        barThickness: 30,
      },
      {
        label: 'Expense',
        data: [15000, 18000, 22000, 28000],
        backgroundColor: '#ff80b2',
        borderRadius: 5,
        barThickness: 30,
      },
    ],
  };
  // Keep it 'bar' for all modes to ensure the "double graph" persists
  currentChartType = computed<ChartType>(() => 'bar');

  currentSalesData = computed<ChartData<'bar'>>(() => {
    const mode = this.viewMode();
    // We return a brand new object spread to ensure Angular/Chart.js detects the change
    if (mode === 'quarterly') return { ...this.quarterlySales };
    if (mode === 'yearly') return { ...this.yearlySales };
    return { ...this.monthlySales };
  });

  chartOptions = computed<ChartConfiguration['options']>(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: 'bottom',
        labels: { usePointStyle: true, pointStyle: 'circle', padding: 20 },
      },
    },
    scales: {
      x: { grid: { display: false }, border: { display: false } },
      y: {
        beginAtZero: true,
        grid: { color: '#f0f0f0' },
        border: { display: false, dash: [5, 5] },
        ticks: { callback: (value) => '$' + value },
      },
    },
  }));
  // Inside your Reports class
  topProducts = signal([
    {
      name: 'Classic Pancakes',
      description: 'Switch own discussions an pro...',
      image: 'images/pancakes.png',
      totalSold: 3542,
      totalRevenue: '$6549.38',
      store: 'Moa Market',
    },
    {
      name: 'Egg Benedict',
      description: 'Switch own discussions an pro...',
      image: 'images/eggs-benedict.png',
      totalSold: 3542,
      totalRevenue: '$6549.38',
      store: 'Super Shop',
    },
    {
      name: 'Avocado Toast',
      description: 'Switch own discussions an pro...',
      image: 'images/avocado-toast.png',
      totalSold: 3542,
      totalRevenue: '$6549.38',
      store: 'Poly Shop',
    },

    {
      name: 'Classic Pancakes',
      description: 'Switch own discussions an pro...',
      image: 'images/pancakes.png',
      totalSold: 3542,
      totalRevenue: '$6549.38',
      store: 'Moa Market',
    },
    {
      name: 'Egg Benedict',
      description: 'Switch own discussions an pro...',
      image: 'images/eggs-benedict.png',
      totalSold: 3542,
      totalRevenue: '$6549.38',
      store: 'Super Shop',
    },
    {
      name: 'Avocado Toast',
      description: 'Switch own discussions an pro...',
      image: 'images/avocado-toast.png',
      totalSold: 3542,
      totalRevenue: '$6549.38',
      store: 'Poly Shop',
    },
  ]);

  // Donut Chart 1: Sales by Location
  locationSalesData: ChartData<'doughnut'> = {
    labels: ['Town City', 'Down Town', 'Airports'],
    datasets: [
      {
        data: [12354, 8000, 5000],
        backgroundColor: ['#8b5cf6', '#a78bfa', '#ddd6fe'], // Shades of purple
        hoverOffset: 4,
      },
    ],
  };

  // Donut Chart 2: Purchase by Location
  locationPurchaseData: ChartData<'doughnut'> = {
    labels: ['Town City', 'Down Town', 'Airports'],
    datasets: [
      {
        data: [32654, 21000, 9000],
        backgroundColor: ['#ff80b2', '#ffadd2', '#fce7f3'], // Shades of pink
        hoverOffset: 4,
      },
    ],
  };

  // Options for Donut Charts to match the image (Cutout makes it a thin ring)
  donutOptions: ChartConfiguration<'doughnut'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '70%',
    plugins: {
      legend: {
        display: true,
        position: 'right',
        labels: { usePointStyle: true, pointStyle: 'circle' },
      },
    },
  };
}
