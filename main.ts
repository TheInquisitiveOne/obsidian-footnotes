import { 
  addIcon,
  Editor, 
  EditorPosition, 
  EditorSuggest, 
  EditorSuggestContext,
  EditorSuggestTriggerInfo,
  MarkdownView, 
  Plugin
} from "obsidian";

//Add chevron-up-square icon from lucide for mobile toolbar (temporary until Obsidian updates to Lucide v0.130.0)
addIcon("chevron-up-square", `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-chevron-up-square"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"></rect><polyline points="8,14 12,10 16,14"></polyline></svg>`);

export default class MyPlugin extends Plugin {

  private NumReOnlyMarkers = /\[\^(\d+)\]/gi;
  private NamedDetailLineRegex = /\[\^([^\[\]]+)\]:/;
  private NamedAllDetails = /\[\^([^\[\]]+)\]:/g;
  private NamedReOnlyMarkers = /\[\^([^\[\]]+)\](?!:)/dg;
  private NamedRe = /(?<=\[\^)([^\[\]]+)(?=\])/;

  async onload() {
    this.addCommand({
      id: "insert-autonumbered-footnote",
      name: "Insert / Navigate Auto-Numbered Footnote",
      icon: "plus-square",
      checkCallback: (checking: boolean) => {
        if (checking)
          return !!this.app.workspace.getActiveViewOfType(MarkdownView);
        this.insertAutonumFootnote();
      },
    });
    this.addCommand({
      id: "insert-named-footnote",
      name: "Insert / Navigate Named Footnote",
      icon: "chevron-up-square",
      checkCallback: (checking: boolean) => {
        if (checking)
          return !!this.app.workspace.getActiveViewOfType(MarkdownView);
        this.insertNamedFootnote();
      }
    });
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