import { Component, IterableDiffers } from '@angular/core';
import {UUID} from 'uuid-generator-ts';
var result=localStorage.getItem("Id");

let uuid = new UUID();
if(result==null){
  uuid.getDashFreeUUID();
  localStorage.setItem("Id",uuid.toString());
  }
else
  uuid=new UUID(result);
@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {
  title = 'Client';
}

