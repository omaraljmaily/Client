import { Component, OnInit } from '@angular/core';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss']
})
export class HomeComponent implements OnInit {

  started:boolean=false;
  downloadStatus=0.0;
  uploadStatus=0.0;
  pingStatus=0.0;

  canvasWidth = 300
  centralLabel = ''
  downloadName = 'Download'
  uploadName = 'Upload'
  pingName = 'Ping'
  downloadOptions:any = {
    hasNeedle: true,
    needleColor: 'gray',
    needleUpdateSpeed: 1000,
    arcColors: ['#4caf50'],
    needleStartValue: 50,
}
uploadOptions:any = {
  hasNeedle: true,
  needleColor: 'gray',
  needleUpdateSpeed: 1000,
  arcColors: ['#e91e63'],
  needleStartValue: 50,
}
pingOptions:any = {
  hasNeedle: true,
  needleColor: 'gray',
  needleUpdateSpeed: 1000,
  arcColors: ['#2196f3'],
  needleStartValue: 50,
}

  worker = new Worker(new URL('../app.worker', import.meta.url));
  constructor() { }

  ngOnInit(): void {
    
  }




  startTest(){
    this.started=true;
    if (typeof Worker !== 'undefined') {
      // Create a new
      
      var interval = setInterval( () => { this.worker.postMessage('status') }, 100)

     this.worker.onmessage = ({ data }) => {
        
        var data = data?.split(';')
        var status = Number(data[0])
        if (status >= 4) {
            clearInterval(interval)
            this.started=false;
            this.worker = new Worker(new URL('../app.worker',import.meta.url));
        }
        if (status === 5) {
            // speedtest cancelled, clear output data
            data = []
        }
        let downloadResult= (status==1&&data[1]==0)?"Starting":data[1]  
        let uploadResult = (status==3&&data[2]==0)?"Starting":data[2]
        let pingResult = data[3]  
        if(downloadResult&& downloadResult!="Starting")
          this.downloadStatus=downloadResult;   
        if(uploadResult&& uploadResult!="Starting")
          this.uploadStatus=uploadResult;
        if(pingResult&& pingResult!="Starting")
          this.pingStatus=pingResult;
      };
      let id=localStorage.getItem("Id")??"";

      this.worker.postMessage(id);
      this.worker.postMessage('start');
    } else {
      // Web Workers are not supported in this environment.
      // You should add a fallback so that your program still executes correctly.
    }

  }

  stopTest(){
    this.started=false;
    if (this.worker) this.worker.postMessage('abort')
  }

  



}
