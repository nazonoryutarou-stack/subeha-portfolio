package jp.subeha.wordtiming;

import android.Manifest;
import android.app.Activity;
import android.content.ContentValues;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.media.AudioFormat;
import android.net.Uri;
import android.os.Bundle;
import android.os.Environment;
import android.os.ParcelFileDescriptor;
import android.provider.MediaStore;
import android.speech.RecognitionListener;
import android.speech.RecognitionPart;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.Date;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

public class MainActivity extends Activity implements RecognitionListener {
    private static final int REQ_FILE = 1001;
    private static final int REQ_MIC = 1002;
    private TextView status;
    private Uri sourceUri;
    private ParcelFileDescriptor recognizerInputPfd;
    private Thread audioWriterThread;
    private SpeechRecognizer recognizer;
    private boolean pendingOnDevice = true;
    private final List<Row> rows = new ArrayList<>();
    private final Set<String> seen = new HashSet<>();
    private int segmentCount = 0;

    static final class Row {
        final String text; final long startMs; final int confidence; final String source;
        Row(String text, long startMs, int confidence, String source) {
            this.text=text; this.startMs=startMs; this.confidence=confidence; this.source=source;
        }
    }

    @Override protected void onCreate(Bundle state) {
        super.onCreate(state);
        LinearLayout root=new LinearLayout(this); root.setOrientation(LinearLayout.VERTICAL); root.setPadding(32,32,32,32);
        TextView title=new TextView(this); title.setText("Subeha Word Timing Probe\n16kHz / mono / PCM16LE を入力"); title.setTextSize(20f); root.addView(title);
        Button pick=new Button(this); pick.setText("1. PCMファイルを選ぶ"); pick.setOnClickListener(v->pickFile()); root.addView(pick);
        Button onDevice=new Button(this); onDevice.setText("2A. ON-DEVICEで解析（推奨）"); onDevice.setOnClickListener(v->startRequested(true)); root.addView(onDevice);
        Button system=new Button(this); system.setText("2B. SYSTEM認識で解析（on-device失敗時）"); system.setOnClickListener(v->startRequested(false)); root.addView(system);
        Button stop=new Button(this); stop.setText("停止"); stop.setOnClickListener(v->{if(recognizer!=null)recognizer.cancel();finishSession("cancelled");}); root.addView(stop);
        status=new TextView(this); status.setTextSize(14f); status.setTextIsSelectable(true); status.setText("PCMを選んでください。\n");
        ScrollView scroll=new ScrollView(this); scroll.addView(status);
        root.addView(scroll,new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT,0,1f));
        setContentView(root);
    }

    private void pickFile(){
        Intent i=new Intent(Intent.ACTION_OPEN_DOCUMENT); i.addCategory(Intent.CATEGORY_OPENABLE); i.setType("*/*"); startActivityForResult(i,REQ_FILE);
    }

    @Override protected void onActivityResult(int requestCode,int resultCode,Intent data){
        super.onActivityResult(requestCode,resultCode,data);
        if(requestCode==REQ_FILE&&resultCode==RESULT_OK&&data!=null){
            sourceUri=data.getData();
            if(sourceUri!=null){try{getContentResolver().takePersistableUriPermission(sourceUri,Intent.FLAG_GRANT_READ_URI_PERMISSION);}catch(Exception ignored){} log("selected: "+sourceUri);}
        }
    }

    private void startRequested(boolean onDevice){
        pendingOnDevice=onDevice;
        if(sourceUri==null){log("ERROR: 先にPCMを選択してください");return;}
        if(checkSelfPermission(Manifest.permission.RECORD_AUDIO)!=PackageManager.PERMISSION_GRANTED){
            requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO},REQ_MIC); return;
        }
        startRecognition(onDevice);
    }

    @Override public void onRequestPermissionsResult(int requestCode,String[] permissions,int[] results){
        super.onRequestPermissionsResult(requestCode,permissions,results);
        if(requestCode==REQ_MIC&&results.length>0&&results[0]==PackageManager.PERMISSION_GRANTED) startRecognition(pendingOnDevice);
        else if(requestCode==REQ_MIC) log("ERROR: SpeechRecognizer利用のためRECORD_AUDIO権限が必要でした");
    }

    private void startRecognition(boolean onDevice){
        cleanupRecognizer(); rows.clear(); seen.clear(); segmentCount=0;
        final ParcelFileDescriptor writerPfd;
        try{ParcelFileDescriptor[] pipe=ParcelFileDescriptor.createPipe();recognizerInputPfd=pipe[0];writerPfd=pipe[1];}
        catch(Exception e){log("ERROR creating audio pipe: "+e);return;}

        try{
            if(onDevice){
                if(!SpeechRecognizer.isOnDeviceRecognitionAvailable(this)){log("ERROR: on-device recognizer unavailable. SYSTEMを試してください");closePfd();return;}
                recognizer=SpeechRecognizer.createOnDeviceSpeechRecognizer(this);
            }else recognizer=SpeechRecognizer.createSpeechRecognizer(this);
            recognizer.setRecognitionListener(this);

            Intent i=new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
            i.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL,RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
            i.putExtra(RecognizerIntent.EXTRA_LANGUAGE,"ja-JP");
            i.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS,true);
            i.putExtra(RecognizerIntent.EXTRA_REQUEST_WORD_TIMING,true);
            i.putExtra(RecognizerIntent.EXTRA_REQUEST_WORD_CONFIDENCE,true);
            i.putExtra(RecognizerIntent.EXTRA_AUDIO_SOURCE,recognizerInputPfd);
            i.putExtra(RecognizerIntent.EXTRA_AUDIO_SOURCE_CHANNEL_COUNT,1);
            i.putExtra(RecognizerIntent.EXTRA_AUDIO_SOURCE_ENCODING,AudioFormat.ENCODING_PCM_16BIT);
            i.putExtra(RecognizerIntent.EXTRA_AUDIO_SOURCE_SAMPLING_RATE,16000);
            i.putExtra(RecognizerIntent.EXTRA_SEGMENTED_SESSION,RecognizerIntent.EXTRA_AUDIO_SOURCE);
            if(onDevice)i.putExtra(RecognizerIntent.EXTRA_PREFER_OFFLINE,true);

            log("START mode="+(onDevice?"on_device":"system")+" lang=ja-JP wordTiming=true");
            recognizer.startListening(i);
            startAudioWriter(writerPfd);
        }catch(Exception e){log("START ERROR: "+e);finishSession("start_error");}
    }

    @Override public void onReadyForSpeech(Bundle params){log("ready");}
    @Override public void onBeginningOfSpeech(){log("beginning_of_speech");}
    @Override public void onRmsChanged(float rmsdB){}
    @Override public void onBufferReceived(byte[] buffer){}
    @Override public void onEndOfSpeech(){log("end_of_speech");}
    @Override public void onError(int error){log("ERROR code="+error);finishSession("error_"+error);}
    @Override public void onResults(Bundle results){collect(results,"final");log("onResults parts_total="+rows.size());finishSession("final");}
    @Override public void onPartialResults(Bundle partialResults){
        ArrayList<String> t=partialResults.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
        if(t!=null&&!t.isEmpty())log("partial: "+t.get(0));
    }
    @Override public void onEvent(int eventType,Bundle params){}
    @Override public void onSegmentResults(Bundle segmentResults){segmentCount++;int before=rows.size();collect(segmentResults,"segment_"+segmentCount);log("segment "+segmentCount+": +"+(rows.size()-before)+" parts, total="+rows.size());}
    @Override public void onEndOfSegmentedSession(){log("end_of_segmented_session");finishSession("segmented_end");}

    private void collect(Bundle b,String source){
        ArrayList<RecognitionPart> parts=b.getParcelableArrayList(SpeechRecognizer.RECOGNITION_PARTS,RecognitionPart.class);
        if(parts==null||parts.isEmpty()){
            ArrayList<String> text=b.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
            if(text!=null&&!text.isEmpty())log(source+" text(no parts): "+text.get(0)); else log(source+" returned no recognition_parts");
            return;
        }
        for(RecognitionPart p:parts){
            String raw=p.getRawText(); long ts=p.getTimestampMillis(); String key=ts+"\u0000"+raw;
            if(seen.add(key)){rows.add(new Row(raw,ts,p.getConfidenceLevel(),source));if(rows.size()<=30)log(String.format(Locale.ROOT,"%8d ms  %s",ts,raw));}
        }
    }

    private void finishSession(String reason){
        closePfd();
        if(!rows.isEmpty()){
            try{Uri out=saveJsonl(reason);log("SAVED: "+out+" parts="+rows.size());}catch(Exception e){log("SAVE ERROR: "+e);}
        }else log("NO TIMED PARTS SAVED reason="+reason);
        cleanupRecognizer();
    }

    private Uri saveJsonl(String reason)throws IOException{
        rows.sort(Comparator.comparingLong(r->r.startMs));
        String stamp=new SimpleDateFormat("yyyyMMdd-HHmmss",Locale.ROOT).format(new Date());
        String name="subeha-word-timing-"+stamp+".jsonl";
        ContentValues cv=new ContentValues();
        cv.put(MediaStore.Downloads.DISPLAY_NAME,name);cv.put(MediaStore.Downloads.MIME_TYPE,"application/x-ndjson");
        cv.put(MediaStore.Downloads.RELATIVE_PATH,Environment.DIRECTORY_DOWNLOADS+"/SubehaWordTiming");
        Uri uri=getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI,cv);
        if(uri==null)throw new IOException("MediaStore insert failed");
        try(OutputStream os=getContentResolver().openOutputStream(uri)){
            if(os==null)throw new IOException("openOutputStream failed");
            String meta="{\"type\":\"meta\",\"engine\":\"android.speech.SpeechRecognizer\",\"language\":\"ja-JP\",\"sample_rate\":16000,\"channels\":1,\"encoding\":\"PCM16LE\",\"finish_reason\":\""+esc(reason)+"\"}\n";
            os.write(meta.getBytes(StandardCharsets.UTF_8));
            for(int n=0;n<rows.size();n++){
                Row r=rows.get(n);Long next=n+1<rows.size()?rows.get(n+1).startMs:null;
                String line="{\"type\":\"part\",\"text\":\""+esc(r.text)+"\",\"start_ms\":"+r.startMs+",\"next_start_ms\":"+(next==null?"null":next)+",\"confidence_level\":"+r.confidence+",\"source\":\""+esc(r.source)+"\"}\n";
                os.write(line.getBytes(StandardCharsets.UTF_8));
            }
        }
        return uri;
    }

    private static String esc(String s){
        if(s==null)return "";
        return s.replace("\\","\\\\").replace("\"","\\\"").replace("\n","\\n").replace("\r","\\r");
    }

    private void startAudioWriter(ParcelFileDescriptor writerPfd){
        audioWriterThread=new Thread(()->{
            long total=0;
            try(InputStream in=getContentResolver().openInputStream(sourceUri);OutputStream out=new ParcelFileDescriptor.AutoCloseOutputStream(writerPfd)){
                if(in==null)throw new IOException("openInputStream returned null");
                byte[] buf=new byte[64*1024];int n;
                while(!Thread.currentThread().isInterrupted()&&(n=in.read(buf))>=0){if(n==0)continue;out.write(buf,0,n);total+=n;}
                out.flush();long bytes=total;runOnUiThread(()->log("audio_source_eof bytes="+bytes));
            }catch(Exception e){
                runOnUiThread(()->log("audio writer: "+e.getClass().getSimpleName()+": "+e.getMessage()));
                try{writerPfd.close();}catch(Exception ignored){}
            }
        },"pcm-audio-writer");
        audioWriterThread.start();
    }

    private void closePfd(){
        if(audioWriterThread!=null){audioWriterThread.interrupt();audioWriterThread=null;}
        if(recognizerInputPfd!=null){try{recognizerInputPfd.close();}catch(Exception ignored){}recognizerInputPfd=null;}
    }
    private void cleanupRecognizer(){if(recognizer!=null){try{recognizer.destroy();}catch(Exception ignored){}recognizer=null;}}
    private void log(String s){status.append(s+"\n");}
    @Override protected void onDestroy(){cleanupRecognizer();closePfd();super.onDestroy();}
}
