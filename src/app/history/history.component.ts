import { Component, OnInit } from '@angular/core';
import { IHistory } from '../Models/history';
import { HistoryService } from './history.service';


@Component({
  selector: 'app-history',
  templateUrl: './history.component.html',
  styleUrls: ['./history.component.scss']
})
export class HistoryComponent implements OnInit {

  constructor( private historyService:HistoryService) { }
  histories!: IHistory[];
  ngOnInit(): void {
    this.getHistory();
    console.log(this.histories)
  }

  getHistory(){
    var userId=localStorage.getItem("Id")??'';
    this.historyService.getHistoryData(userId).subscribe((result:any)=>{
      this.histories=result;
      console.log(this.histories)
    },error=>{
      console.log(error);
    });
  }



  

}
