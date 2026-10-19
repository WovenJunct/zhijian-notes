package app.zhijian.notes.backup;
import java.io.*;import org.json.JSONArray;
public final class MarkdownExport {public static void write(OutputStream out,JSONArray notes,File media)throws Exception{ArchiveCodec.writeMarkdown(out,notes,media);}}
