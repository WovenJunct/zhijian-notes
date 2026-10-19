package app.zhijian.notes.files;

import android.content.ContentProvider;
import android.content.ContentValues;
import android.database.Cursor;
import android.database.MatrixCursor;
import android.net.Uri;
import android.os.ParcelFileDescriptor;
import android.provider.OpenableColumns;
import java.io.File;
import java.io.FileNotFoundException;
import java.io.IOException;
import java.util.List;

/** Unexported in the manifest; only explicit read URI grants leave the app. */
public final class NoteFileProvider extends ContentProvider {
 @Override public boolean onCreate(){return true;}
 private File file(Uri uri)throws FileNotFoundException{
  try{
   List<String> parts=uri.getPathSegments();
   if(!"content".equals(uri.getScheme())||!(getContext().getPackageName()+".files").equals(uri.getAuthority())||uri.getQuery()!=null||uri.getFragment()!=null||parts.size()!=3||!"attachments".equals(parts.get(0))||!parts.get(2).equals(NoteFileStore.safeName(parts.get(2))))throw new IOException("附件地址无效");
   return NoteFileStore.resolve(getContext(),parts.get(1));
  }catch(IOException|RuntimeException error){throw new FileNotFoundException("附件不存在或无法读取");}
 }
 @Override public String getType(Uri uri){try{return NoteFileStore.mime(file(uri),uri.getLastPathSegment(),null);}catch(IOException e){throw new IllegalArgumentException("附件不存在或格式无效");}}
 @Override public Cursor query(Uri uri,String[] projection,String selection,String[] selectionArgs,String sortOrder){
  final File file;try{file=file(uri);}catch(FileNotFoundException e){throw new IllegalArgumentException(e.getMessage());}
  String[] columns=projection==null?new String[]{OpenableColumns.DISPLAY_NAME,OpenableColumns.SIZE}:projection;MatrixCursor cursor=new MatrixCursor(columns,1);Object[] row=new Object[columns.length];
  for(int i=0;i<columns.length;i++){if(OpenableColumns.DISPLAY_NAME.equals(columns[i]))row[i]=uri.getLastPathSegment();else if(OpenableColumns.SIZE.equals(columns[i]))row[i]=file.length();}cursor.addRow(row);return cursor;
 }
 @Override public ParcelFileDescriptor openFile(Uri uri,String mode)throws FileNotFoundException{if(!"r".equals(mode))throw new SecurityException("附件只能只读打开");return ParcelFileDescriptor.open(file(uri),ParcelFileDescriptor.MODE_READ_ONLY);}
 @Override public Uri insert(Uri uri,ContentValues values){throw new UnsupportedOperationException("只读附件");}
 @Override public int update(Uri uri,ContentValues values,String selection,String[] selectionArgs){throw new UnsupportedOperationException("只读附件");}
 @Override public int delete(Uri uri,String selection,String[] selectionArgs){throw new UnsupportedOperationException("只读附件");}
}
