/// <reference lib="webworker" />


let testStatus = 0; // 0=not started, 1=download test, 2=ping test, 3=upload test, 4=finished, 5=abort/error
let downloadStatus = ''; // download speed in megabit/s with 2 decimal digits
let uploadStatus = ''; // upload speed in megabit/s with 2 decimal digits
let pingStatus = ''; // ping in milliseconds with 2 decimal digits

let id='';// uuid generate for user and stored in localStorage

function url_sep (url:string) { return url.match(/\?/) ? '&' : '?'; }


const settings = {
  timeUpload: 15, // duration of upload test in seconds
  timeDownload: 15, // duration of download test in seconds
  timeUploadGraceTime: 3, //time to wait in seconds before actually measuring ul speed (wait for buffers to fill)
  timeDownloadGraceTime: 1.5, //time to wait in seconds before actually measuring dl speed (wait for TCP window to increase)
  countPing: 35, // number of pings to perform in ping test
  endpointDownload: 'https://localhost:5001/download', // path to a large file or garbage.php, used for download test. must be relative to this js file
  endpointUpload: 'https://localhost:5001/upload', // path to an empty file, used for upload test. must be relative to this js file
  endpointPing: 'https://localhost:5001/ping', // path to an empty file, used for ping test. must be relative to this js file
  xhrDownloadMultistream: 10, // number of download streams to use (can be different if enable_quirks is active)
  xhrUploadMultistream: 3, // number of upload streams to use (can be different if enable_quirks is active)
  xhrIgnoreErrors: 1, // 0=fail on errors, 1=attempt to restart a stream if it fails, 2=ignore all errors
  xhrDownloadUseBlob: false, // if set to true, it reduces ram usage but uses the hard drive (useful with large garbagePhp_chunkSize and/or high xhr_dlMultistream)
  chunkSize: 20, // size of chunks sent by garbage.php (can be different if enable_quirks is active)
  enableQuirks: true, // enable quirks for specific browsers. currently it overrides settings to optimize for specific browsers, unless they are already being overridden with the start command
  overheadCompensationFactor: 1048576 / 925000, //compensation for HTTP+TCP+IP+ETH overhead. 925000 is how much data is actually carried over 1048576 (1mb) bytes downloaded/uploaded. This default value assumes HTTP+TCP+IPv4+ETH with typical MTUs over the Internet. You may want to change this if you're going through your local network with a different MTU or if you're going over IPv6 (see doc.md for some other values)
  endPointSaveData: 'https://localhost:5001/add', // path to the script that adds data to the database
  forceIE11Workaround:true
};


let xhr:any = null; // array of currently active xhr requests
let interval:any = null; // timer used in tests




addEventListener('message', ({ data }) => {
  const response = `worker response to ${data}`;

  const params = data.split(' ');
  if (params[0] === 'status') { // return status
    postMessage(testStatus + ';' + downloadStatus + ';' + uploadStatus + ';' + pingStatus)
  }  
  
  else if (params[0] === 'start' && testStatus === 0) { // start new test
    testStatus = 1
            DownloadTest(
                function ()
                {
                    testStatus = 2;
                    pingTest(
                        function ()
                        {
                            testStatus = 3;
                            UploadTest(function ()
                            {
                                console.log('Donnnnnn')
                                testStatus = 4;
                                sendData()
                            })
                        })
                })

}

else{
    // parse uuid
  id=params[0];
}


  postMessage(response);
});





// stops all XHR activity, aggressively
function clearRequests () {
  if (xhr) {
      for (let i = 0; i < xhr.length; i++) {
          try { xhr[i].onprogress = null; xhr[i].onload = null; xhr[i].onerror = null } catch (e) { }
          try { xhr[i].upload.onprogress = null; xhr[i].upload.onload = null; xhr[i].upload.onerror = null } catch (e) { }
          try { xhr[i].abort() } catch (e) { }
          try { delete (xhr[i]) } catch (e) { }
      }
      xhr = null
  }
}




// download test, calls done function when it's over
let downloadCalled = false; // used to prevent multiple accidental calls to dlTest
function DownloadTest (done:any) {
    if (downloadCalled) return; else downloadCalled = true // dlTest already called?
    if (settings.endpointDownload === '-1') {done(); return}
    let totLoaded = 0.0, // total number of loaded bytes
        startT = new Date().getTime(), // timestamp when test was started
        graceTimeDone = false, //set to true after the grace time is past
        failed = false; // set to true if a stream fails
    xhr = []
    // function to create a download stream. streams are slightly delayed so that they will not end at the same time
    const testStream = function (i:number, delay:number) {
        setTimeout(function () {
            if (testStatus !== 1) return // delayed stream ended up starting after the end of the download test
            let prevLoaded = 0; // number of bytes loaded last time onprogress was called
            const x = new XMLHttpRequest();
            xhr[i] = x
            xhr[i].onprogress = function (event:any) {
                if (testStatus !== 1) {
                    try {
                        x.abort()
                    } catch (e) {
                    }
                } // just in case this XHR is still running after the download test
                // progress event, add number of new loaded bytes to totLoaded
                const loadDiff = event.loaded <= 0 ? 0 : (event.loaded - prevLoaded);
                if (isNaN(loadDiff) || !isFinite(loadDiff) || loadDiff < 0) return // just in case
                totLoaded += loadDiff
                prevLoaded = event.loaded
            }
            xhr[i].onload = function () {
                // the large file has been loaded entirely, start again
                try {
                    xhr[i].abort()
                } catch (e) {
                } // reset the stream data to empty ram
                testStream(i, 0)
            }
            xhr[i].onerror = function () {
                // error
                if (settings.xhrIgnoreErrors === 0) failed = true //abort
                try {
                    xhr[i].abort()
                } catch (e) {
                }
                delete (xhr[i])
                if (settings.xhrIgnoreErrors === 1) testStream(i, 100) //restart stream after 100ms
            }
            // send xhr
            try {
                if (settings.xhrDownloadUseBlob) xhr[i].responseType = 'blob'; else xhr[i].responseType = 'arraybuffer'
            } catch (e) {
            }
            xhr[i].open('GET', settings.endpointDownload + url_sep(settings.endpointDownload) + 'r=' + Math.random() + '&ckSize=' + settings.chunkSize, true) // random string to prevent caching
            xhr[i].send()
        }, 1 + delay)
    };
    // open streams
    for (let i = 0; i < settings.xhrDownloadMultistream; i++) {
        testStream(i, 100 * i)
    }
    // every 200ms, update downloadStatus
    interval = setInterval(function () {
        const t = new Date().getTime() - startT;
        if (t < 200) return
        if (!graceTimeDone){
            if (t > 1000 * settings.timeDownloadGraceTime){
                if (totLoaded > 0){ // if the connection is so slow that we didn't get a single chunk yet, do not reset
                    startT = new Date().getTime()
                    totLoaded = 0.0;
                }
                graceTimeDone = true;
            }
        }else{
            const speed = totLoaded / (t / 1000.0);
            downloadStatus = ((speed * 8 * settings.overheadCompensationFactor)/1048576).toFixed(2) // speed is multiplied by 8 to go from bytes to bits, overhead compensation is applied, then everything is divided by 1048576 to go to megabits/s
            if (((t / 1000.0) > settings.timeDownload && Number( downloadStatus) > 0) || failed) { // test is over, stop streams and timer
                if (failed || isNaN(Number(downloadStatus))) downloadStatus = 'Fail'
                clearRequests()
                clearInterval(interval)
                done()
            }
        }
    }, 200)
}


// ping test, function done is called when it's over
let pingCalled = false; // used to prevent multiple accidental calls to pingTest
function pingTest (done:any) {
    if (pingCalled) return; else pingCalled = true // pingTest already called?
    if (settings.endpointPing === '-1') {done(); return}
    let prevT:any = null; // last time a pong was received
    let ping = 0.0; // current ping value
    let i = 0; // counter of pongs received
    //var prevInstspd = 0 // last ping time, used for jitter calculation
    xhr = []
    // ping function
    const doPing = function () {
        prevT = new Date().getTime()
        xhr[0] = new XMLHttpRequest()
        xhr[0].onload = function () {
            // pong
            if (i === 0) {
                prevT = new Date().getTime() // first pong
            } else {
                const instspd = (new Date().getTime() - prevT);
                if (i === 1) ping = instspd; /* first ping, can't tell jitter yet*/ else {
                    ping = ping * 0.9 + instspd * 0.1 // ping, weighted average
                }
            }
            pingStatus = ping.toFixed(2)
            i++
            if (i < settings.countPing) doPing(); else done() // more pings to do?
        }
        xhr[0].onerror = function () {
            // a ping failed, cancel test
            if (settings.xhrIgnoreErrors === 0) { //abort
                pingStatus = 'Fail'
                clearRequests()
                done()
            }
            if (settings.xhrIgnoreErrors === 1) doPing() //retry ping
            if (settings.xhrIgnoreErrors === 2) { //ignore failed ping
                i++
                if (i < settings.countPing) doPing(); else done() // more pings to do?
            }
        }
        // sent xhr
        xhr[0].open('GET', settings.endpointPing + url_sep(settings.endpointPing) + 'r=' + Math.random(), true) // random string to prevent caching
        xhr[0].send()
    };
    doPing() // start first ping
}




// upload test, calls done function whent it's over
// garbage data for upload test
let r = new Array(1048576);
let i;
try {
   //r = new Float32Array(r); 
   for (i = 0; i < r.length; i++)r[i] = Math.random() } catch (e) { }
let req:any = [];
let reqSmall:any = [];
for (i = 0; i < 20; i++) req.push(r)
req = new Blob(req)
//r = new ArrayBuffer(262144)
try {// r = new Float32Array(r); 
  for (i = 0; i < r.length; i++)r[i] = Math.random() } catch (e) { }
reqSmall.push(r)
reqSmall = new Blob(reqSmall)
let uploadCalled = false; // used to prevent multiple accidental calls to ulTest
function UploadTest (done:any) {
    if (uploadCalled) return; else uploadCalled = true // ulTest already called?
    if (settings.endpointUpload === '-1') {done(); return}
    let totLoaded = 0.0, // total number of transmitted bytes
        startT = new Date().getTime(), // timestamp when test was started
        graceTimeDone = false, //set to true after the grace time is past
        failed = false; // set to true if a stream fails
    xhr = []
    // function to create an upload stream. streams are slightly delayed so that they will not end at the same time
    const testStream = function (i:number, delay:number) {
        setTimeout(function () {
            if (testStatus !== 3) return // delayed stream ended up starting after the end of the upload test
            let prevLoaded = 0; // number of bytes transmitted last time onprogress was called
            const x = new XMLHttpRequest();
            xhr[i] = x
            let ie11workaround;
            if (settings.forceIE11Workaround) ie11workaround = true; else {
                try {
                    xhr[i].upload.onprogress
                    ie11workaround = false
                } catch (e) {
                    ie11workaround = true
                }
            }
            if (ie11workaround) {

                // IE11 workarond: xhr.upload does not work properly, therefore we send a bunch of small 256k requests and use the onload event as progress. This is not precise, especially on fast connections
                xhr[i].onload = function () {
                    totLoaded += 262144
                    testStream(i, 0)
                }
                xhr[i].onerror = function () {
                    // error, abort
                    if (settings.xhrIgnoreErrors === 0) failed = true //abort
                    try {
                        xhr[i].abort()
                    } catch (e) {
                    }
                    delete (xhr[i])
                    if (settings.xhrIgnoreErrors === 1) testStream(i, 100); //restart stream after 100ms
                }
                xhr[i].open('GET', settings.endpointUpload + url_sep(settings.endpointUpload) + 'r=' + Math.random(), true) // random string to prevent caching
                xhr[i].setRequestHeader('Content-Encoding', 'identity') // disable compression (some browsers may refuse it, but data is incompressible anyway)
                xhr[i].send(reqSmall)
            } else {
                // REGULAR version, no workaround
                xhr[i].upload.onprogress = function (event:any) {

                    if (testStatus !== 3) {
                        try {
                            x.abort()
                        } catch (e) {
                        }
                    } // just in case this XHR is still running after the upload test
                    // progress event, add number of new loaded bytes to totLoaded
                    const loadDiff = event.loaded <= 0 ? 0 : (event.loaded - prevLoaded);
                    if (isNaN(loadDiff) || !isFinite(loadDiff) || loadDiff < 0) return // just in case
                    totLoaded += loadDiff
                    prevLoaded = event.loaded
                }
                xhr[i].upload.onload = function () {

                    // this stream sent all the garbage data, start again
                    testStream(i, 0)
                }
                xhr[i].upload.onerror = function () {

                    if (settings.xhrIgnoreErrors === 0) failed = true //abort
                    try {
                        xhr[i].abort()
                    } catch (e) {
                    }
                    delete (xhr[i])
                    if (settings.xhrIgnoreErrors === 1) testStream(i, 100) //restart stream after 100ms
                }

                // send xhr
                xhr[i].open('GET', settings.endpointUpload + url_sep(settings.endpointUpload) + 'r=' + Math.random(), true) // random string to prevent caching
                xhr[i].setRequestHeader('Content-Encoding', 'identity') // disable compression (some browsers may refuse it, but data is incompressible anyway)
                xhr[i].send(req)
            }
        }, 1)
    };
    // open streams
    for (let i = 0; i < settings.xhrUploadMultistream; i++) {
        testStream(i, 100 * i)
    }
    // every 200ms, update ulStatus
    interval = setInterval(function () {
        const t = new Date().getTime() - startT;
        if (t < 200) return
        if (!graceTimeDone){
            if (t > 1000 * settings.timeUploadGraceTime){
                if (totLoaded > 0){ // if the connection is so slow that we didn't get a single chunk yet, do not reset
                    startT = new Date().getTime()
                    totLoaded = 0.0;
                }
                graceTimeDone = true;
            }
        }else{

            const speed = totLoaded / (t / 1000.0);
            uploadStatus = ((speed * 8 * settings.overheadCompensationFactor)/1048576).toFixed(2) // speed is multiplied by 8 to go from bytes to bits, overhead compensation is applied, then everything is divided by 1048576 to go to megabits/s
            if (((t / 1000.0) > settings.timeUpload && Number(uploadStatus) > 0) || failed) { // test is over, stop streams and timer
                if (failed || isNaN(Number(uploadStatus))) uploadStatus = 'Fail'
                clearRequests()
                clearInterval(interval)
                done()
            }
        }
    }, 200)
}


function sendData(){  
  xhr = new XMLHttpRequest()
  xhr.onload = function () { console.log('SendData Load '+xhr.responseText) }
  xhr.onerror = function () { console.log('SendData ERROR '+xhr) }
  xhr.open('POST', settings.endPointSaveData+"?r="+Math.random());
  xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded')
  try{
    var data={
      Download:downloadStatus,
      Upload:uploadStatus,
      Ping:pingStatus,
      Id:id
    };
    xhr.send(JSON.stringify(data))
  }catch(ex){
    console.log(ex);
    var postData = 
      'download='+encodeURIComponent(downloadStatus)+
      '&upload='+encodeURIComponent(uploadStatus)+
      '&ping='+encodeURIComponent(pingStatus)+
      '&id='+encodeURIComponent(id)
    xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded')
    xhr.send(postData)
  }


}