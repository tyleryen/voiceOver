window.AudioContext = window.AudioContext || window.webkitAudioContext;
var audioContext = new AudioContext();
var audioInput = null,
    realAudioInput = null,
    inputPoint = null,
    audioRecorder = null;
var rafID = null;
var analyserContext = null;
var canvasWidth, canvasHeight;

var socket = io.connect('localhost:9000');

socket.on('connect', function() {
    console.log('Client connected') ;
});

var isRecording = false;

function initAudio() {
    if (!navigator.getUserMedia)
        navigator.getUserMedia = navigator.getUserMedia ||
            navigator.webkitGetUserMedia ||
            navigator.mozGetUserMedia ||
            navigator.msGetUserMedia;
    if (navigator.getUserMedia) {
        navigator.getUserMedia({audio:true}, gotStream, function (e) {
            alert('Error getting audio');
            console.log(e);
        });
    }
}

function createDownloadLink() {
    audioRecorder && audioRecorder.exportWAV(function(blob) {
        var url = URL.createObjectURL(blob);
        var li = document.createElement('li');
        var au = document.createElement('audio');
        var hf = document.createElement('a');

        var stream = ss.createStream();

        ss(socket).emit('send to server', stream, {
            name : 'audio.wav',
            size: blob.size
        });

        var blobstream = ss.createBlobReadStream(blob);
        blobstream.pipe(stream);

        au.controls = true;
        au.src = url;
        hf.href = url;
        hf.download = 'audio.wav';
        hf.innerHTML = hf.download;
        li.appendChild(au);
        li.appendChild(hf);
        recordingslist.appendChild(li);
    });
}

var stopTime = 2;
function startRecording() {
    audioContext.resume();
    $('#serverResponse').html('Recording...');
    audioRecorder.record();
    $('#btn').html('Stop Recording');
    isRecording = true;
    updateAnalysers();
}
function stopRecording() {
    audioContext.suspend();
    stopTime = audioContext.currentTime;
    isRecording = false;
    $('#btn').html('Start Recording');
    audioRecorder.stop();
    cancelAnalyserUpdates();
    createDownloadLink();
    audioRecorder.clear();
    $('#serverResponse').html('Stopped Recording.');
}
function toggleRecording() {
    if (isRecording === false) {
        startRecording();
    } else if (isRecording === true){
        stopRecording();
    }
}
function gotStream(stream) {
    inputPoint = audioContext.createGain();
    // Create an AudioNode from the stream.
    realAudioInput = audioContext.createMediaStreamSource(stream);
    audioInput = realAudioInput;
    audioInput.connect(inputPoint);
    analyserNode = audioContext.createAnalyser();
    analyserNode.fftSize = 2048;
    inputPoint.connect(analyserNode);
    audioRecorder = new Recorder(inputPoint);
    zeroGain = audioContext.createGain();
    zeroGain.gain.value = 0.0;
    inputPoint.connect(zeroGain);
    zeroGain.connect(audioContext.destination);
}

//Audio Visual
function cancelAnalyserUpdates() {
    window.cancelAnimationFrame(rafID);
    rafID = null;
}
function updateAnalysers() {
    if (!analyserContext) {
        var canvas = document.getElementById("analyser");
        canvasWidth = canvas.width;
        canvasHeight = canvas.height;
        analyserContext = canvas.getContext('2d');
    }
    {
        var selectBox = document.getElementById("selectBox");
        var selectedVal = selectBox.options[selectBox.selectedIndex].value;
        var bufferLength = analyserNode.frequencyBinCount;
        var freqByteData = new Uint8Array(bufferLength);
        var SPACING = 2;
        var BAR_WIDTH = 2;
        var numBars = Math.round(canvasWidth / SPACING);

        rafID = window.requestAnimationFrame(updateAnalysers);
        analyserContext.fillRect(0, 0, canvasWidth, canvasHeight);

        if (selectedVal === 'bars') {
            //Frequency Bars
            analyserContext.clearRect(0, 0, canvasWidth, canvasHeight);
            analyserNode.getByteFrequencyData(freqByteData);
            analyserContext.fillStyle = '#2790C4';
            analyserContext.lineCap = 'round';
            var multiplier = analyserNode.frequencyBinCount / numBars;
            // Draw rectangle for each frequency bin.
            for (var i = 0; i < numBars; ++i) {
                var magnitude = 0;
                var offset = Math.floor(i * multiplier);
                // gotta sum/average the block, or we miss narrow-bandwidth spikes
                for (var j = 0; j < multiplier; j++) {
                    magnitude += freqByteData[offset + j];
                }
                magnitude = magnitude / multiplier;
                analyserContext.fillRect(i * SPACING, canvasHeight, BAR_WIDTH, -magnitude);
            }
        } else if (selectedVal === 'waves') {
            //Waveform
            analyserNode.getByteTimeDomainData(freqByteData);
            analyserContext.fillRect(0, 0, canvasWidth, canvasHeight);
            analyserContext.lineWidth = 5;
            analyserContext.strokeStyle = '#2790C4';
            analyserContext.beginPath();
            var sliceWidth = canvasWidth * 1.0 / bufferLength;
            var x = 0;
            for (var i = 0; i < bufferLength; i++) {
                var v = freqByteData[i] / 128.0;
                var y = v * canvasHeight / 2;

                if (i === 0) {
                    analyserContext.moveTo(x, y);
                } else {
                    analyserContext.lineTo(x, y);
                }
                x += sliceWidth;
            }
            analyserContext.clearRect(0, 0, canvasWidth, canvasHeight);
            analyserContext.lineTo(canvasWidth, canvasHeight / 2);
            analyserContext.stroke();
        }
    }

    analyserNode.getByteFrequencyData(freqByteData);

    var average = 0;
    for (var i = 0; i < bufferLength; i++) {
        var level = freqByteData[i] / 128.0;
        average += level / bufferLength;
    }
    if (average < 0.005 && (audioContext.currentTime - stopTime) > 2) {
        $('#silence').html('Is is not silent');
        stopRecording();
    }
}

window.addEventListener('load', initAudio);
