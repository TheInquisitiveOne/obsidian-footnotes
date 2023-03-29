import { notEqual } from "assert";
import { exec } from "child_process";
import { 
  Editor, 
  EditorPosition, 
  EditorSuggest, 
  EditorSuggestContext,
  EditorSuggestTriggerInfo,
  MarkdownView, 
  Plugin 
} from "obsidian";

import { CursorPos, clearScreenDown } from "readline";

export default class MyPlugin extends Plugin {
  //private detailLineRegex = /\[\^(\d+)\]\:/;
  private NumReOnlyMarkers = /\[\^(\d+)\]/gi;
  //private numericalRe = /(\d+)/;

  private NamedDetailLineRegex = /\[\^([^\[\]]+)\]:/;
  private NamedAllDetails = /\[\^([^\[\]]+)\]:/g;
  private NamedReOnlyMarkers = /\[\^([^\[\]]+)\](?!:)/dg;
  private NamedRe = /(?<=\[\^)([^\[\]]+)(?=\])/;

  async onload() {
    this.addCommand({
      id: "insert-autonumbered-footnote",
      name: "Insert / Navigate Auto-Numbered Footnote",
      checkCallback: (checking: boolean) => {
        if (checking)
          return !!this.app.workspace.getActiveViewOfType(MarkdownView);
        this.insertAutonumFootnote();
      },
    });
    this.addCommand({
      id: "insert-named-footnote",
      name: "Insert / Navigate Named Footnote",
      checkCallback: (checking: boolean) => {
        if (checking)
          return !!this.app.workspace.getActiveViewOfType(MarkdownView);
        this.insertNamedFootnote();
      }
    });
    /*this.addCommand({
      id: "Popup",
      name: "Popup",
      checkCallback: (checking: boolean) => {
        if (checking)
          return !!this.app.workspace.getActiveViewOfType(MarkdownView)
        this.footnotePicker();
      }
    });*/
  }

  private listExistingFootnoteDetails(
    doc: Editor
  ) {
    let FootnoteDetailList: string[] = [];
    
    //search each line for footnote details and add to list
    for (let i = 0; i < doc.lineCount(); i++) {
          let theLine = doc.getLine(i);
          let lineMatch = theLine.match(this.NamedAllDetails);
          if (lineMatch) {
            let temp = lineMatch[0];
            temp = temp.replace("[^","");
            temp = temp.replace("]:","");

            FootnoteDetailList.push(temp);
          }
        }
    if (FootnoteDetailList.length > 0) {
      return FootnoteDetailList;
    } else {
      return null;
    }
  }

  private listExistingFootnoteMarkersAndLocations(
    doc: Editor
  ) {
    type markerEntry = {
      footnote: string;
      lineNum: number;
      startIndex: number;
    }
    let markerEntry;

    let FootnoteMarkerInfo = [];
    //search each line for footnote markers
    //for each, add their name, line number, and start index to FootnoteMarkerInfo
    for (let i = 0; i < doc.lineCount(); i++) {
      let theLine = doc.getLine(i);
      let lineMatch;

      while ((lineMatch = this.NamedReOnlyMarkers.exec(theLine)) != null) {
        markerEntry = {
          footnote: lineMatch[0],
          lineNum: i,
          startIndex: lineMatch.index
        }
        FootnoteMarkerInfo.push(markerEntry);
      }
    }
    return FootnoteMarkerInfo;
  }
  
  insertAutonumFootnote() {
    const mdView = this.app.workspace.getActiveViewOfType(MarkdownView);

    if (!mdView) return false;
    if (mdView.editor == undefined) return false;

    const doc = mdView.editor;
    const cursorPosition = doc.getCursor();
    const lineText = doc.getLine(cursorPosition.line);
    const markdownText = mdView.data;

    if (this.shouldJumpFromDetailToMarker(lineText, cursorPosition, doc))
      return;
    if (this.shouldJumpFromMarkerToDetail(lineText, cursorPosition, doc))
      return;

    return this.shouldCreateAutonumFootnote(
      lineText,
      cursorPosition,
      doc,
      markdownText
    );
  }

  private shouldJumpFromDetailToMarker(
    lineText: string,
    cursorPosition: EditorPosition,
    doc: Editor
  ) {
    // check if we're in a footnote detail line ("[^1]: footnote")
    // if so, jump cursor back to the footnote in the text
    // https://github.com/akaalias/obsidian-footnotes#improved-quick-navigation
    let match = lineText.match(this.NamedDetailLineRegex);
    if (match) {
      let s = match[0];
      let index = s.replace("[^", "");
      index = index.replace("]:", "");
      let footnote = s.replace(":", "");

      let returnLineIndex = cursorPosition.line;
      // find the FIRST OCCURENCE where this footnote exists in the text
      for (let i = 0; i < doc.lineCount(); i++) {
        let scanLine = doc.getLine(i);
        if (scanLine.contains(footnote)) {
          let cursorLocationIndex = scanLine.indexOf(footnote);
          returnLineIndex = i;
          doc.setCursor({
            line: returnLineIndex,
            ch: cursorLocationIndex + footnote.length,
          });
          return true;
        }
      }
    }

    return false;
  }

  private shouldJumpFromMarkerToDetail(
    lineText: string,
    cursorPosition: EditorPosition,
    doc: Editor
  ) {
    // Jump cursor TO detail marker

    // does this line have a footnote marker?
    // does the cursor overlap with one of them?
    // if so, which one?
    // find this footnote marker's detail line
    // place cursor there
    let markerTarget = null;

    let FootnoteMarkerInfo = this.listExistingFootnoteMarkersAndLocations(doc);
    let currentLine = cursorPosition.line;
    let footnotesOnLine = FootnoteMarkerInfo.filter(markerEntry => markerEntry.lineNum === currentLine);

    if (footnotesOnLine != null && (footnotesOnLine.length-1 > 0)) {
      for (let i = 0; i <= footnotesOnLine.length-1; i++) {
        if (footnotesOnLine[i].footnote !== null) {
          let marker = footnotesOnLine[i].footnote;
          let indexOfMarkerInLine = footnotesOnLine[i].startIndex;
          if (
            cursorPosition.ch >= indexOfMarkerInLine &&
            cursorPosition.ch <= indexOfMarkerInLine + marker.length
          ) {
            markerTarget = marker;
            break;
          }
        }
      }
    }
    if (markerTarget !== null) {
      // extract index
      let match = markerTarget.match(this.NamedRe);
      if (match) {
        let indexString = match[0];
        //let markerIndex = Number(indexString);

        // find the first line with this detail marker index in it.
        for (let i = 0; i < doc.lineCount(); i++) {
          let theLine = doc.getLine(i);
          let lineMatch = theLine.match(this.NamedDetailLineRegex);
          if (lineMatch) {
            // compare to the index
            let indexMatch = lineMatch[1];
            //let indexMatchNumber = Number(indexMatch);
            if (indexMatch == indexString) {
              doc.setCursor({ line: i, ch: lineMatch[0].length + 1 });
              return true;
            }
          }
        }
      }
    }
    return false;
  }

  private shouldCreateAutonumFootnote(
    lineText: string,
    cursorPosition: EditorPosition,
    doc: Editor,
    markdownText: string
  ) {
    // create new footnote with the next numerical index
    let matches = markdownText.match(this.NumReOnlyMarkers);
    let numbers: Array<number> = [];
    let currentMax = 1;

    if (matches != null) {
      for (let i = 0; i <= matches.length - 1; i++) {
        let match = matches[i];
        match = match.replace("[^", "");
        match = match.replace("]", "");
        let matchNumber = Number(match);
        numbers[i] = matchNumber;
        if (matchNumber + 1 > currentMax) {
          currentMax = matchNumber + 1;
        }
      }
    }

    let footNoteId = currentMax;
    let footnoteMarker = `[^${footNoteId}]`;
    let linePart1 = lineText.substr(0, cursorPosition.ch);
    let linePart2 = lineText.substr(cursorPosition.ch);
    let newLine = linePart1 + footnoteMarker + linePart2;

    doc.replaceRange(
      newLine,
      { line: cursorPosition.line, ch: 0 },
      { line: cursorPosition.line, ch: lineText.length }
    );

    let lastLineIndex = doc.lastLine();
    let lastLine = doc.getLine(lastLineIndex);

    while (lastLineIndex > 0) {
      lastLine = doc.getLine(lastLineIndex);
      if (lastLine.length > 0) {
        doc.replaceRange(
          "",
          { line: lastLineIndex, ch: 0 },
          { line: doc.lastLine(), ch: 0 }
        );
        break;
      }
      lastLineIndex--;
    }

    let footnoteDetail = `\n[^${footNoteId}]: `;

    let list = this.listExistingFootnoteDetails(doc);
    
    if (list===null && currentMax == 1) {
      footnoteDetail = "\n" + footnoteDetail;
      doc.setLine(doc.lastLine(), lastLine + footnoteDetail);
      doc.setCursor(doc.lastLine() - 1, footnoteDetail.length - 1);
    } else {
      doc.setLine(doc.lastLine(), lastLine + footnoteDetail);
      doc.setCursor(doc.lastLine(), footnoteDetail.length - 1);
    }
  }


  // Functions for Named Footnotes


  insertNamedFootnote() {
    const mdView = this.app.workspace.getActiveViewOfType(MarkdownView);

    if (!mdView) return false;
    if (mdView.editor == undefined) return false;

    const doc = mdView.editor;
    const cursorPosition = doc.getCursor();
    const lineText = doc.getLine(cursorPosition.line);
    const markdownText = mdView.data;

    if (this.shouldJumpFromDetailToMarker(lineText, cursorPosition, doc))
      return;
    if (this.shouldJumpFromMarkerToDetail(lineText, cursorPosition, doc))
      return;

    if (this.shouldCreateMatchingFootnoteDetail(lineText, cursorPosition, doc))
      return; 
    return this.shouldCreateFootnoteMarker(
      lineText,
      cursorPosition,
      doc,
      markdownText
    );


  }
  
  private shouldCreateMatchingFootnoteDetail(
    lineText: string,
    cursorPosition: EditorPosition,
    doc: Editor
  ) {
    // Create matching footnote detail for footnote marker
    
    // does this line have a footnote marker?
    // does the cursor overlap with one of them?
    // if so, which one?
    // does this footnote marker have a detail line?
    // if not, create it and place cursor there
    let reOnlyMarkersMatches = lineText.match(this.NamedReOnlyMarkers);

    let markerTarget = null;

    if (reOnlyMarkersMatches){
      for (let i = 0; i <= reOnlyMarkersMatches.length; i++) {
        let marker = reOnlyMarkersMatches[i];
        if (marker != undefined) {
          let indexOfMarkerInLine = lineText.indexOf(marker);
          if (
            cursorPosition.ch >= indexOfMarkerInLine &&
            cursorPosition.ch <= indexOfMarkerInLine + marker.length
          ) {
            markerTarget = marker;
            break;
          }
        }
      }
    }

    if (markerTarget != null) {
      //extract footnote
      let match = markerTarget.match(this.NamedRe)
      //find if this footnote exists by listing existing footnote details
      if (match) {
        let footnoteId = match[0];
        
        let list: string[] = this.listExistingFootnoteDetails(doc);
        
        // Check if the list is empty OR if the list doesn't include current footnote
        // if so, add detail for the current footnote
        if(list === null || !list.includes(footnoteId)) {
          let lastLineIndex = doc.lastLine();
          let lastLine = doc.getLine(lastLineIndex);

          while (lastLineIndex > 0) {
            lastLine = doc.getLine(lastLineIndex);
            if (lastLine.length > 0) {
              doc.replaceRange(
                "",
                { line: lastLineIndex, ch: 0 },
                { line: doc.lastLine(), ch: 0 }
              );
              break;
            }
            lastLineIndex--;
          }
          
          let footnoteDetail = `\n[^${footnoteId}]: `;
                    
          if (list===null || list.length < 1) {
            footnoteDetail = "\n" + footnoteDetail;
            doc.setLine(doc.lastLine(), lastLine + footnoteDetail);
            doc.setCursor(doc.lastLine() - 1, footnoteDetail.length - 1);
          } else {
            doc.setLine(doc.lastLine(), lastLine + footnoteDetail);
            doc.setCursor(doc.lastLine(), footnoteDetail.length - 1);
          }

          return true;
        }
        return; 
      }
    }
  }

  private shouldCreateFootnoteMarker(
    lineText: string,
    cursorPosition: EditorPosition,
    doc: Editor,
    markdownText: string
  ) {
    //create empty footnote marker for name input
    let emptyMarker = `[^]`;
    doc.replaceRange(emptyMarker,doc.getCursor());
    //move cursor in between [^ and ]
    doc.setCursor(cursorPosition.line, cursorPosition.ch+2);
    //open footnotePicker popup
    
  }
}


//footnotePicker popup copied in from https://github.com/SilentVoid13/Templater
/*
export class footnotePicker extends EditorSuggest<TpSuggestDocumentation> {
  private tp_keyword_regex =
  /tp\.(?<module>[a-z]*)?(?<fn_trigger>\.(?<fn>[a-z_]*)?)?$/;
  private documentation: Documentation;
  private latest_trigger_info: EditorSuggestTriggerInfo;
  private module_name: ModuleName | string;
  private function_trigger: boolean;
  private function_name: string;

  constructor() {
    super(app);
    this.documentation = new Documentation();
  }

  onTrigger(
      cursor: EditorPosition,
      editor: Editor,
      _file: TFile
  ): EditorSuggestTriggerInfo | null {
      const range = editor.getRange(
          { line: cursor.line, ch: 0 },
          { line: cursor.line, ch: cursor.ch }
      );
      const match = this.tp_keyword_regex.exec(range);
      if (!match) {
          return null;
      }

      let query: string;
      const module_name = (match.groups && match.groups["module"]) || "";
      this.module_name = module_name;

      if (match.groups && match.groups["fn_trigger"]) {
          if (module_name == "" || !is_module_name(module_name)) {
              return null;
          }
          this.function_trigger = true;
          this.function_name = match.groups["fn"] || "";
          query = this.function_name;
      } else {
          this.function_trigger = false;
          query = this.module_name;
      }

      const trigger_info: EditorSuggestTriggerInfo = {
          start: { line: cursor.line, ch: cursor.ch - query.length },
          end: { line: cursor.line, ch: cursor.ch },
          query: query,
      };
      this.latest_trigger_info = trigger_info;
      return trigger_info;
  }

  getSuggestions(context: EditorSuggestContext): TpSuggestDocumentation[] {
      let suggestions: Array<TpSuggestDocumentation>;
      if (this.module_name && this.function_trigger) {
          suggestions = this.documentation.get_all_functions_documentation(
              this.module_name as ModuleName
          ) as TpFunctionDocumentation[];
      } else {
          suggestions = this.documentation.get_all_modules_documentation();
      }
      if (!suggestions) {
          return [];
      }
      return suggestions.filter((s) => s.name.startsWith(context.query));
  }

  renderSuggestion(value: TpSuggestDocumentation, el: HTMLElement): void {
      el.createEl("b", { text: value.name });
      el.createEl("br");
      if (this.function_trigger && is_function_documentation(value)) {
          el.createEl("code", { text: value.definition });
      }
      if (value.description) {
          el.createEl("div", { text: value.description });
      }
  }

  selectSuggestion(
      value: TpSuggestDocumentation,
      _evt: MouseEvent | KeyboardEvent
  ): void {
      const active_view = app.workspace.getActiveViewOfType(MarkdownView);
      if (!active_view) {
          // TODO: Error msg
          return;
      }
      active_view.editor.replaceRange(
          value.name,
          this.latest_trigger_info.start,
          this.latest_trigger_info.end
      );
      if (
          this.latest_trigger_info.start.ch == this.latest_trigger_info.end.ch
      ) {
          // Dirty hack to prevent the cursor being at the
          // beginning of the word after completion,
          // Not sure what's the cause of this bug.
          const cursor_pos = this.latest_trigger_info.end;
          cursor_pos.ch += value.name.length;
          active_view.editor.setCursor(cursor_pos);
      }
  }
}
*/