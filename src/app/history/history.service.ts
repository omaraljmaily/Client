import { Injectable } from '@angular/core';
import { environment } from 'src/environments/environment';
import { HttpClient } from '@angular/common/http';

@Injectable({
  providedIn: 'root'
})
export class HistoryService {
  baseUrl = environment.apiUrl;

  constructor(private http: HttpClient) { }

  getHistoryData(userId:string){
    return this.http.get(this.baseUrl+'get/'+userId);
  }
}
