import { Component, OnInit } from '@angular/core';
import { Chart, ChartDataSets, ChartOptions } from 'chart.js';
import { Color, Label } from 'ng2-charts';
import { IHistory } from '../Models/history';
import { ChartService } from './chart.service';

@Component({
  selector: 'app-chart',
  templateUrl: './chart.component.html',
  styleUrls: ['./chart.component.scss']
})
export class ChartComponent implements OnInit {


  downloadData:any=[];
  uploadData:any=[];
  pingData:any=[];
  LabelData:any=[]
  

  lineChartData: ChartDataSets[] = [
    { data: this.downloadData, label: 'Download' },
    { data: this.uploadData, label: 'Upload' },
  ];

  lineChartPingData: ChartDataSets[] = [
    { data: this.pingData, label: 'Ping' },
  ];
  
  lineChartLabels: Label[] = this.LabelData;
    
  lineChartOptions = {
    responsive: true,
  };
  chartType:Chart.ChartType='line'
  lineChartLegend = true;
  lineChartType:Chart.ChartType =this.chartType;
  lineChartPlugins = [];


  chartsData!: IHistory[];

  constructor(private chartService:ChartService) { }

  ngOnInit(): void {
    this.getChart()
  }

  getChart(){
    var userId=localStorage.getItem("Id")??'';
    this.chartService.getChartData(userId).subscribe((result:any)=>{
      this.chartsData=result;
      this.downloadData= this.chartsData.map(({download})=>download);
      this.uploadData= this.chartsData.map(({upload})=>upload);
      this.pingData= this.chartsData.map(({ping})=>ping);
      this.LabelData= this.chartsData.map(({logTime})=>logTime);
      
      this.lineChartPingData[0].data=this.pingData
      
      this.lineChartData[0].data=this.downloadData
      this.lineChartData[1].data=this.uploadData
      this.lineChartLabels=this.LabelData

    },error=>{
      console.log(error);
    });
  }


}
