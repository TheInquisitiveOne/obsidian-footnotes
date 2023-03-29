'use strict';

var obsidian = require('obsidian');

/******************************************************************************
Copyright (c) Microsoft Corporation.

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
PERFORMANCE OF THIS SOFTWARE.
***************************************************************************** */

function __awaiter(thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
}

class MyPlugin extends obsidian.Plugin {
    constructor() {
        super(...arguments);
        //private detailLineRegex = /\[\^(\d+)\]\:/;
        this.NumReOnlyMarkers = /\[\^(\d+)\]/gi;
        //private numericalRe = /(\d+)/;
        this.NamedDetailLineRegex = /\[\^([^\[\]]+)\]:/;
        this.NamedAllDetails = /\[\^([^\[\]]+)\]:/g;
        this.NamedReOnlyMarkers = /\[\^([^\[\]]+)\](?!:)/dg;
        this.NamedRe = /(?<=\[\^)([^\[\]]+)(?=\])/;
    }
    onload() {
        return __awaiter(this, void 0, void 0, function* () {
            this.addCommand({
                id: "insert-autonumbered-footnote",
                name: "Insert / Navigate Auto-Numbered Footnote",
                checkCallback: (checking) => {
                    if (checking)
                        return !!this.app.workspace.getActiveViewOfType(obsidian.MarkdownView);
                    this.insertAutonumFootnote();
                },
            });
            this.addCommand({
                id: "insert-named-footnote",
                name: "Insert / Navigate Named Footnote",
                checkCallback: (checking) => {
                    if (checking)
                        return !!this.app.workspace.getActiveViewOfType(obsidian.MarkdownView);
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
        });
    }
    listExistingFootnoteDetails(doc) {
        let FootnoteDetailList = [];
        //search each line for footnote details and add to list
        for (let i = 0; i < doc.lineCount(); i++) {
            let theLine = doc.getLine(i);
            let lineMatch = theLine.match(this.NamedAllDetails);
            if (lineMatch) {
                let temp = lineMatch[0];
                temp = temp.replace("[^", "");
                temp = temp.replace("]:", "");
                FootnoteDetailList.push(temp);
            }
        }
        if (FootnoteDetailList.length > 0) {
            return FootnoteDetailList;
        }
        else {
            return null;
        }
    }
    listExistingFootnoteMarkersAndLocations(doc) {
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
                };
                FootnoteMarkerInfo.push(markerEntry);
            }
        }
        return FootnoteMarkerInfo;
    }
    insertAutonumFootnote() {
        const mdView = this.app.workspace.getActiveViewOfType(obsidian.MarkdownView);
        if (!mdView)
            return false;
        if (mdView.editor == undefined)
            return false;
        const doc = mdView.editor;
        const cursorPosition = doc.getCursor();
        const lineText = doc.getLine(cursorPosition.line);
        const markdownText = mdView.data;
        if (this.shouldJumpFromDetailToMarker(lineText, cursorPosition, doc))
            return;
        if (this.shouldJumpFromMarkerToDetail(lineText, cursorPosition, doc))
            return;
        return this.shouldCreateAutonumFootnote(lineText, cursorPosition, doc, markdownText);
    }
    shouldJumpFromDetailToMarker(lineText, cursorPosition, doc) {
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
    shouldJumpFromMarkerToDetail(lineText, cursorPosition, doc) {
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
        if (footnotesOnLine != null && (footnotesOnLine.length - 1 > 0)) {
            for (let i = 0; i <= footnotesOnLine.length - 1; i++) {
                if (footnotesOnLine[i].footnote !== null) {
                    let marker = footnotesOnLine[i].footnote;
                    let indexOfMarkerInLine = footnotesOnLine[i].startIndex;
                    if (cursorPosition.ch >= indexOfMarkerInLine &&
                        cursorPosition.ch <= indexOfMarkerInLine + marker.length) {
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
    shouldCreateAutonumFootnote(lineText, cursorPosition, doc, markdownText) {
        // create new footnote with the next numerical index
        let matches = markdownText.match(this.NumReOnlyMarkers);
        let currentMax = 1;
        if (matches != null) {
            for (let i = 0; i <= matches.length - 1; i++) {
                let match = matches[i];
                match = match.replace("[^", "");
                match = match.replace("]", "");
                let matchNumber = Number(match);
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
        doc.replaceRange(newLine, { line: cursorPosition.line, ch: 0 }, { line: cursorPosition.line, ch: lineText.length });
        let lastLineIndex = doc.lastLine();
        let lastLine = doc.getLine(lastLineIndex);
        while (lastLineIndex > 0) {
            lastLine = doc.getLine(lastLineIndex);
            if (lastLine.length > 0) {
                doc.replaceRange("", { line: lastLineIndex, ch: 0 }, { line: doc.lastLine(), ch: 0 });
                break;
            }
            lastLineIndex--;
        }
        let footnoteDetail = `\n[^${footNoteId}]: `;
        let list = this.listExistingFootnoteDetails(doc);
        if (list === null && currentMax == 1) {
            footnoteDetail = "\n" + footnoteDetail;
            doc.setLine(doc.lastLine(), lastLine + footnoteDetail);
            doc.setCursor(doc.lastLine() - 1, footnoteDetail.length - 1);
        }
        else {
            doc.setLine(doc.lastLine(), lastLine + footnoteDetail);
            doc.setCursor(doc.lastLine(), footnoteDetail.length - 1);
        }
    }
    // Functions for Named Footnotes
    insertNamedFootnote() {
        const mdView = this.app.workspace.getActiveViewOfType(obsidian.MarkdownView);
        if (!mdView)
            return false;
        if (mdView.editor == undefined)
            return false;
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
        return this.shouldCreateFootnoteMarker(lineText, cursorPosition, doc, markdownText);
    }
    shouldCreateMatchingFootnoteDetail(lineText, cursorPosition, doc) {
        // Create matching footnote detail for footnote marker
        // does this line have a footnote marker?
        // does the cursor overlap with one of them?
        // if so, which one?
        // does this footnote marker have a detail line?
        // if not, create it and place cursor there
        let reOnlyMarkersMatches = lineText.match(this.NamedReOnlyMarkers);
        let markerTarget = null;
        if (reOnlyMarkersMatches) {
            for (let i = 0; i <= reOnlyMarkersMatches.length; i++) {
                let marker = reOnlyMarkersMatches[i];
                if (marker != undefined) {
                    let indexOfMarkerInLine = lineText.indexOf(marker);
                    if (cursorPosition.ch >= indexOfMarkerInLine &&
                        cursorPosition.ch <= indexOfMarkerInLine + marker.length) {
                        markerTarget = marker;
                        break;
                    }
                }
            }
        }
        if (markerTarget != null) {
            //extract footnote
            let match = markerTarget.match(this.NamedRe);
            //find if this footnote exists by listing existing footnote details
            if (match) {
                let footnoteId = match[0];
                let list = this.listExistingFootnoteDetails(doc);
                // Check if the list is empty OR if the list doesn't include current footnote
                // if so, add detail for the current footnote
                if (list === null || !list.includes(footnoteId)) {
                    let lastLineIndex = doc.lastLine();
                    let lastLine = doc.getLine(lastLineIndex);
                    while (lastLineIndex > 0) {
                        lastLine = doc.getLine(lastLineIndex);
                        if (lastLine.length > 0) {
                            doc.replaceRange("", { line: lastLineIndex, ch: 0 }, { line: doc.lastLine(), ch: 0 });
                            break;
                        }
                        lastLineIndex--;
                    }
                    let footnoteDetail = `\n[^${footnoteId}]: `;
                    if (list === null || list.length < 1) {
                        footnoteDetail = "\n" + footnoteDetail;
                        doc.setLine(doc.lastLine(), lastLine + footnoteDetail);
                        doc.setCursor(doc.lastLine() - 1, footnoteDetail.length - 1);
                    }
                    else {
                        doc.setLine(doc.lastLine(), lastLine + footnoteDetail);
                        doc.setCursor(doc.lastLine(), footnoteDetail.length - 1);
                    }
                    return true;
                }
                return;
            }
        }
    }
    shouldCreateFootnoteMarker(lineText, cursorPosition, doc, markdownText) {
        //create empty footnote marker for name input
        let emptyMarker = `[^]`;
        doc.replaceRange(emptyMarker, doc.getCursor());
        //move cursor in between [^ and ]
        doc.setCursor(cursorPosition.line, cursorPosition.ch + 2);
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

module.exports = MyPlugin;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFpbi5qcyIsInNvdXJjZXMiOlsibm9kZV9tb2R1bGVzL3RzbGliL3RzbGliLmVzNi5qcyIsIm1haW4udHMiXSwic291cmNlc0NvbnRlbnQiOlsiLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxyXG5Db3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi5cclxuXHJcblBlcm1pc3Npb24gdG8gdXNlLCBjb3B5LCBtb2RpZnksIGFuZC9vciBkaXN0cmlidXRlIHRoaXMgc29mdHdhcmUgZm9yIGFueVxyXG5wdXJwb3NlIHdpdGggb3Igd2l0aG91dCBmZWUgaXMgaGVyZWJ5IGdyYW50ZWQuXHJcblxyXG5USEUgU09GVFdBUkUgSVMgUFJPVklERUQgXCJBUyBJU1wiIEFORCBUSEUgQVVUSE9SIERJU0NMQUlNUyBBTEwgV0FSUkFOVElFUyBXSVRIXHJcblJFR0FSRCBUTyBUSElTIFNPRlRXQVJFIElOQ0xVRElORyBBTEwgSU1QTElFRCBXQVJSQU5USUVTIE9GIE1FUkNIQU5UQUJJTElUWVxyXG5BTkQgRklUTkVTUy4gSU4gTk8gRVZFTlQgU0hBTEwgVEhFIEFVVEhPUiBCRSBMSUFCTEUgRk9SIEFOWSBTUEVDSUFMLCBESVJFQ1QsXHJcbklORElSRUNULCBPUiBDT05TRVFVRU5USUFMIERBTUFHRVMgT1IgQU5ZIERBTUFHRVMgV0hBVFNPRVZFUiBSRVNVTFRJTkcgRlJPTVxyXG5MT1NTIE9GIFVTRSwgREFUQSBPUiBQUk9GSVRTLCBXSEVUSEVSIElOIEFOIEFDVElPTiBPRiBDT05UUkFDVCwgTkVHTElHRU5DRSBPUlxyXG5PVEhFUiBUT1JUSU9VUyBBQ1RJT04sIEFSSVNJTkcgT1VUIE9GIE9SIElOIENPTk5FQ1RJT04gV0lUSCBUSEUgVVNFIE9SXHJcblBFUkZPUk1BTkNFIE9GIFRISVMgU09GVFdBUkUuXHJcbioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqICovXHJcbi8qIGdsb2JhbCBSZWZsZWN0LCBQcm9taXNlICovXHJcblxyXG52YXIgZXh0ZW5kU3RhdGljcyA9IGZ1bmN0aW9uKGQsIGIpIHtcclxuICAgIGV4dGVuZFN0YXRpY3MgPSBPYmplY3Quc2V0UHJvdG90eXBlT2YgfHxcclxuICAgICAgICAoeyBfX3Byb3RvX186IFtdIH0gaW5zdGFuY2VvZiBBcnJheSAmJiBmdW5jdGlvbiAoZCwgYikgeyBkLl9fcHJvdG9fXyA9IGI7IH0pIHx8XHJcbiAgICAgICAgZnVuY3Rpb24gKGQsIGIpIHsgZm9yICh2YXIgcCBpbiBiKSBpZiAoT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKGIsIHApKSBkW3BdID0gYltwXTsgfTtcclxuICAgIHJldHVybiBleHRlbmRTdGF0aWNzKGQsIGIpO1xyXG59O1xyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fZXh0ZW5kcyhkLCBiKSB7XHJcbiAgICBpZiAodHlwZW9mIGIgIT09IFwiZnVuY3Rpb25cIiAmJiBiICE9PSBudWxsKVxyXG4gICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoXCJDbGFzcyBleHRlbmRzIHZhbHVlIFwiICsgU3RyaW5nKGIpICsgXCIgaXMgbm90IGEgY29uc3RydWN0b3Igb3IgbnVsbFwiKTtcclxuICAgIGV4dGVuZFN0YXRpY3MoZCwgYik7XHJcbiAgICBmdW5jdGlvbiBfXygpIHsgdGhpcy5jb25zdHJ1Y3RvciA9IGQ7IH1cclxuICAgIGQucHJvdG90eXBlID0gYiA9PT0gbnVsbCA/IE9iamVjdC5jcmVhdGUoYikgOiAoX18ucHJvdG90eXBlID0gYi5wcm90b3R5cGUsIG5ldyBfXygpKTtcclxufVxyXG5cclxuZXhwb3J0IHZhciBfX2Fzc2lnbiA9IGZ1bmN0aW9uKCkge1xyXG4gICAgX19hc3NpZ24gPSBPYmplY3QuYXNzaWduIHx8IGZ1bmN0aW9uIF9fYXNzaWduKHQpIHtcclxuICAgICAgICBmb3IgKHZhciBzLCBpID0gMSwgbiA9IGFyZ3VtZW50cy5sZW5ndGg7IGkgPCBuOyBpKyspIHtcclxuICAgICAgICAgICAgcyA9IGFyZ3VtZW50c1tpXTtcclxuICAgICAgICAgICAgZm9yICh2YXIgcCBpbiBzKSBpZiAoT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKHMsIHApKSB0W3BdID0gc1twXTtcclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuIHQ7XHJcbiAgICB9XHJcbiAgICByZXR1cm4gX19hc3NpZ24uYXBwbHkodGhpcywgYXJndW1lbnRzKTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fcmVzdChzLCBlKSB7XHJcbiAgICB2YXIgdCA9IHt9O1xyXG4gICAgZm9yICh2YXIgcCBpbiBzKSBpZiAoT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKHMsIHApICYmIGUuaW5kZXhPZihwKSA8IDApXHJcbiAgICAgICAgdFtwXSA9IHNbcF07XHJcbiAgICBpZiAocyAhPSBudWxsICYmIHR5cGVvZiBPYmplY3QuZ2V0T3duUHJvcGVydHlTeW1ib2xzID09PSBcImZ1bmN0aW9uXCIpXHJcbiAgICAgICAgZm9yICh2YXIgaSA9IDAsIHAgPSBPYmplY3QuZ2V0T3duUHJvcGVydHlTeW1ib2xzKHMpOyBpIDwgcC5sZW5ndGg7IGkrKykge1xyXG4gICAgICAgICAgICBpZiAoZS5pbmRleE9mKHBbaV0pIDwgMCAmJiBPYmplY3QucHJvdG90eXBlLnByb3BlcnR5SXNFbnVtZXJhYmxlLmNhbGwocywgcFtpXSkpXHJcbiAgICAgICAgICAgICAgICB0W3BbaV1dID0gc1twW2ldXTtcclxuICAgICAgICB9XHJcbiAgICByZXR1cm4gdDtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fZGVjb3JhdGUoZGVjb3JhdG9ycywgdGFyZ2V0LCBrZXksIGRlc2MpIHtcclxuICAgIHZhciBjID0gYXJndW1lbnRzLmxlbmd0aCwgciA9IGMgPCAzID8gdGFyZ2V0IDogZGVzYyA9PT0gbnVsbCA/IGRlc2MgPSBPYmplY3QuZ2V0T3duUHJvcGVydHlEZXNjcmlwdG9yKHRhcmdldCwga2V5KSA6IGRlc2MsIGQ7XHJcbiAgICBpZiAodHlwZW9mIFJlZmxlY3QgPT09IFwib2JqZWN0XCIgJiYgdHlwZW9mIFJlZmxlY3QuZGVjb3JhdGUgPT09IFwiZnVuY3Rpb25cIikgciA9IFJlZmxlY3QuZGVjb3JhdGUoZGVjb3JhdG9ycywgdGFyZ2V0LCBrZXksIGRlc2MpO1xyXG4gICAgZWxzZSBmb3IgKHZhciBpID0gZGVjb3JhdG9ycy5sZW5ndGggLSAxOyBpID49IDA7IGktLSkgaWYgKGQgPSBkZWNvcmF0b3JzW2ldKSByID0gKGMgPCAzID8gZChyKSA6IGMgPiAzID8gZCh0YXJnZXQsIGtleSwgcikgOiBkKHRhcmdldCwga2V5KSkgfHwgcjtcclxuICAgIHJldHVybiBjID4gMyAmJiByICYmIE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh0YXJnZXQsIGtleSwgciksIHI7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX3BhcmFtKHBhcmFtSW5kZXgsIGRlY29yYXRvcikge1xyXG4gICAgcmV0dXJuIGZ1bmN0aW9uICh0YXJnZXQsIGtleSkgeyBkZWNvcmF0b3IodGFyZ2V0LCBrZXksIHBhcmFtSW5kZXgpOyB9XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX2VzRGVjb3JhdGUoY3RvciwgZGVzY3JpcHRvckluLCBkZWNvcmF0b3JzLCBjb250ZXh0SW4sIGluaXRpYWxpemVycywgZXh0cmFJbml0aWFsaXplcnMpIHtcclxuICAgIGZ1bmN0aW9uIGFjY2VwdChmKSB7IGlmIChmICE9PSB2b2lkIDAgJiYgdHlwZW9mIGYgIT09IFwiZnVuY3Rpb25cIikgdGhyb3cgbmV3IFR5cGVFcnJvcihcIkZ1bmN0aW9uIGV4cGVjdGVkXCIpOyByZXR1cm4gZjsgfVxyXG4gICAgdmFyIGtpbmQgPSBjb250ZXh0SW4ua2luZCwga2V5ID0ga2luZCA9PT0gXCJnZXR0ZXJcIiA/IFwiZ2V0XCIgOiBraW5kID09PSBcInNldHRlclwiID8gXCJzZXRcIiA6IFwidmFsdWVcIjtcclxuICAgIHZhciB0YXJnZXQgPSAhZGVzY3JpcHRvckluICYmIGN0b3IgPyBjb250ZXh0SW5bXCJzdGF0aWNcIl0gPyBjdG9yIDogY3Rvci5wcm90b3R5cGUgOiBudWxsO1xyXG4gICAgdmFyIGRlc2NyaXB0b3IgPSBkZXNjcmlwdG9ySW4gfHwgKHRhcmdldCA/IE9iamVjdC5nZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3IodGFyZ2V0LCBjb250ZXh0SW4ubmFtZSkgOiB7fSk7XHJcbiAgICB2YXIgXywgZG9uZSA9IGZhbHNlO1xyXG4gICAgZm9yICh2YXIgaSA9IGRlY29yYXRvcnMubGVuZ3RoIC0gMTsgaSA+PSAwOyBpLS0pIHtcclxuICAgICAgICB2YXIgY29udGV4dCA9IHt9O1xyXG4gICAgICAgIGZvciAodmFyIHAgaW4gY29udGV4dEluKSBjb250ZXh0W3BdID0gcCA9PT0gXCJhY2Nlc3NcIiA/IHt9IDogY29udGV4dEluW3BdO1xyXG4gICAgICAgIGZvciAodmFyIHAgaW4gY29udGV4dEluLmFjY2VzcykgY29udGV4dC5hY2Nlc3NbcF0gPSBjb250ZXh0SW4uYWNjZXNzW3BdO1xyXG4gICAgICAgIGNvbnRleHQuYWRkSW5pdGlhbGl6ZXIgPSBmdW5jdGlvbiAoZikgeyBpZiAoZG9uZSkgdGhyb3cgbmV3IFR5cGVFcnJvcihcIkNhbm5vdCBhZGQgaW5pdGlhbGl6ZXJzIGFmdGVyIGRlY29yYXRpb24gaGFzIGNvbXBsZXRlZFwiKTsgZXh0cmFJbml0aWFsaXplcnMucHVzaChhY2NlcHQoZiB8fCBudWxsKSk7IH07XHJcbiAgICAgICAgdmFyIHJlc3VsdCA9ICgwLCBkZWNvcmF0b3JzW2ldKShraW5kID09PSBcImFjY2Vzc29yXCIgPyB7IGdldDogZGVzY3JpcHRvci5nZXQsIHNldDogZGVzY3JpcHRvci5zZXQgfSA6IGRlc2NyaXB0b3Jba2V5XSwgY29udGV4dCk7XHJcbiAgICAgICAgaWYgKGtpbmQgPT09IFwiYWNjZXNzb3JcIikge1xyXG4gICAgICAgICAgICBpZiAocmVzdWx0ID09PSB2b2lkIDApIGNvbnRpbnVlO1xyXG4gICAgICAgICAgICBpZiAocmVzdWx0ID09PSBudWxsIHx8IHR5cGVvZiByZXN1bHQgIT09IFwib2JqZWN0XCIpIHRocm93IG5ldyBUeXBlRXJyb3IoXCJPYmplY3QgZXhwZWN0ZWRcIik7XHJcbiAgICAgICAgICAgIGlmIChfID0gYWNjZXB0KHJlc3VsdC5nZXQpKSBkZXNjcmlwdG9yLmdldCA9IF87XHJcbiAgICAgICAgICAgIGlmIChfID0gYWNjZXB0KHJlc3VsdC5zZXQpKSBkZXNjcmlwdG9yLnNldCA9IF87XHJcbiAgICAgICAgICAgIGlmIChfID0gYWNjZXB0KHJlc3VsdC5pbml0KSkgaW5pdGlhbGl6ZXJzLnB1c2goXyk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGVsc2UgaWYgKF8gPSBhY2NlcHQocmVzdWx0KSkge1xyXG4gICAgICAgICAgICBpZiAoa2luZCA9PT0gXCJmaWVsZFwiKSBpbml0aWFsaXplcnMucHVzaChfKTtcclxuICAgICAgICAgICAgZWxzZSBkZXNjcmlwdG9yW2tleV0gPSBfO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuICAgIGlmICh0YXJnZXQpIE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh0YXJnZXQsIGNvbnRleHRJbi5uYW1lLCBkZXNjcmlwdG9yKTtcclxuICAgIGRvbmUgPSB0cnVlO1xyXG59O1xyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fcnVuSW5pdGlhbGl6ZXJzKHRoaXNBcmcsIGluaXRpYWxpemVycywgdmFsdWUpIHtcclxuICAgIHZhciB1c2VWYWx1ZSA9IGFyZ3VtZW50cy5sZW5ndGggPiAyO1xyXG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBpbml0aWFsaXplcnMubGVuZ3RoOyBpKyspIHtcclxuICAgICAgICB2YWx1ZSA9IHVzZVZhbHVlID8gaW5pdGlhbGl6ZXJzW2ldLmNhbGwodGhpc0FyZywgdmFsdWUpIDogaW5pdGlhbGl6ZXJzW2ldLmNhbGwodGhpc0FyZyk7XHJcbiAgICB9XHJcbiAgICByZXR1cm4gdXNlVmFsdWUgPyB2YWx1ZSA6IHZvaWQgMDtcclxufTtcclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX3Byb3BLZXkoeCkge1xyXG4gICAgcmV0dXJuIHR5cGVvZiB4ID09PSBcInN5bWJvbFwiID8geCA6IFwiXCIuY29uY2F0KHgpO1xyXG59O1xyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fc2V0RnVuY3Rpb25OYW1lKGYsIG5hbWUsIHByZWZpeCkge1xyXG4gICAgaWYgKHR5cGVvZiBuYW1lID09PSBcInN5bWJvbFwiKSBuYW1lID0gbmFtZS5kZXNjcmlwdGlvbiA/IFwiW1wiLmNvbmNhdChuYW1lLmRlc2NyaXB0aW9uLCBcIl1cIikgOiBcIlwiO1xyXG4gICAgcmV0dXJuIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShmLCBcIm5hbWVcIiwgeyBjb25maWd1cmFibGU6IHRydWUsIHZhbHVlOiBwcmVmaXggPyBcIlwiLmNvbmNhdChwcmVmaXgsIFwiIFwiLCBuYW1lKSA6IG5hbWUgfSk7XHJcbn07XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19tZXRhZGF0YShtZXRhZGF0YUtleSwgbWV0YWRhdGFWYWx1ZSkge1xyXG4gICAgaWYgKHR5cGVvZiBSZWZsZWN0ID09PSBcIm9iamVjdFwiICYmIHR5cGVvZiBSZWZsZWN0Lm1ldGFkYXRhID09PSBcImZ1bmN0aW9uXCIpIHJldHVybiBSZWZsZWN0Lm1ldGFkYXRhKG1ldGFkYXRhS2V5LCBtZXRhZGF0YVZhbHVlKTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fYXdhaXRlcih0aGlzQXJnLCBfYXJndW1lbnRzLCBQLCBnZW5lcmF0b3IpIHtcclxuICAgIGZ1bmN0aW9uIGFkb3B0KHZhbHVlKSB7IHJldHVybiB2YWx1ZSBpbnN0YW5jZW9mIFAgPyB2YWx1ZSA6IG5ldyBQKGZ1bmN0aW9uIChyZXNvbHZlKSB7IHJlc29sdmUodmFsdWUpOyB9KTsgfVxyXG4gICAgcmV0dXJuIG5ldyAoUCB8fCAoUCA9IFByb21pc2UpKShmdW5jdGlvbiAocmVzb2x2ZSwgcmVqZWN0KSB7XHJcbiAgICAgICAgZnVuY3Rpb24gZnVsZmlsbGVkKHZhbHVlKSB7IHRyeSB7IHN0ZXAoZ2VuZXJhdG9yLm5leHQodmFsdWUpKTsgfSBjYXRjaCAoZSkgeyByZWplY3QoZSk7IH0gfVxyXG4gICAgICAgIGZ1bmN0aW9uIHJlamVjdGVkKHZhbHVlKSB7IHRyeSB7IHN0ZXAoZ2VuZXJhdG9yW1widGhyb3dcIl0odmFsdWUpKTsgfSBjYXRjaCAoZSkgeyByZWplY3QoZSk7IH0gfVxyXG4gICAgICAgIGZ1bmN0aW9uIHN0ZXAocmVzdWx0KSB7IHJlc3VsdC5kb25lID8gcmVzb2x2ZShyZXN1bHQudmFsdWUpIDogYWRvcHQocmVzdWx0LnZhbHVlKS50aGVuKGZ1bGZpbGxlZCwgcmVqZWN0ZWQpOyB9XHJcbiAgICAgICAgc3RlcCgoZ2VuZXJhdG9yID0gZ2VuZXJhdG9yLmFwcGx5KHRoaXNBcmcsIF9hcmd1bWVudHMgfHwgW10pKS5uZXh0KCkpO1xyXG4gICAgfSk7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX2dlbmVyYXRvcih0aGlzQXJnLCBib2R5KSB7XHJcbiAgICB2YXIgXyA9IHsgbGFiZWw6IDAsIHNlbnQ6IGZ1bmN0aW9uKCkgeyBpZiAodFswXSAmIDEpIHRocm93IHRbMV07IHJldHVybiB0WzFdOyB9LCB0cnlzOiBbXSwgb3BzOiBbXSB9LCBmLCB5LCB0LCBnO1xyXG4gICAgcmV0dXJuIGcgPSB7IG5leHQ6IHZlcmIoMCksIFwidGhyb3dcIjogdmVyYigxKSwgXCJyZXR1cm5cIjogdmVyYigyKSB9LCB0eXBlb2YgU3ltYm9sID09PSBcImZ1bmN0aW9uXCIgJiYgKGdbU3ltYm9sLml0ZXJhdG9yXSA9IGZ1bmN0aW9uKCkgeyByZXR1cm4gdGhpczsgfSksIGc7XHJcbiAgICBmdW5jdGlvbiB2ZXJiKG4pIHsgcmV0dXJuIGZ1bmN0aW9uICh2KSB7IHJldHVybiBzdGVwKFtuLCB2XSk7IH07IH1cclxuICAgIGZ1bmN0aW9uIHN0ZXAob3ApIHtcclxuICAgICAgICBpZiAoZikgdGhyb3cgbmV3IFR5cGVFcnJvcihcIkdlbmVyYXRvciBpcyBhbHJlYWR5IGV4ZWN1dGluZy5cIik7XHJcbiAgICAgICAgd2hpbGUgKGcgJiYgKGcgPSAwLCBvcFswXSAmJiAoXyA9IDApKSwgXykgdHJ5IHtcclxuICAgICAgICAgICAgaWYgKGYgPSAxLCB5ICYmICh0ID0gb3BbMF0gJiAyID8geVtcInJldHVyblwiXSA6IG9wWzBdID8geVtcInRocm93XCJdIHx8ICgodCA9IHlbXCJyZXR1cm5cIl0pICYmIHQuY2FsbCh5KSwgMCkgOiB5Lm5leHQpICYmICEodCA9IHQuY2FsbCh5LCBvcFsxXSkpLmRvbmUpIHJldHVybiB0O1xyXG4gICAgICAgICAgICBpZiAoeSA9IDAsIHQpIG9wID0gW29wWzBdICYgMiwgdC52YWx1ZV07XHJcbiAgICAgICAgICAgIHN3aXRjaCAob3BbMF0pIHtcclxuICAgICAgICAgICAgICAgIGNhc2UgMDogY2FzZSAxOiB0ID0gb3A7IGJyZWFrO1xyXG4gICAgICAgICAgICAgICAgY2FzZSA0OiBfLmxhYmVsKys7IHJldHVybiB7IHZhbHVlOiBvcFsxXSwgZG9uZTogZmFsc2UgfTtcclxuICAgICAgICAgICAgICAgIGNhc2UgNTogXy5sYWJlbCsrOyB5ID0gb3BbMV07IG9wID0gWzBdOyBjb250aW51ZTtcclxuICAgICAgICAgICAgICAgIGNhc2UgNzogb3AgPSBfLm9wcy5wb3AoKTsgXy50cnlzLnBvcCgpOyBjb250aW51ZTtcclxuICAgICAgICAgICAgICAgIGRlZmF1bHQ6XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKCEodCA9IF8udHJ5cywgdCA9IHQubGVuZ3RoID4gMCAmJiB0W3QubGVuZ3RoIC0gMV0pICYmIChvcFswXSA9PT0gNiB8fCBvcFswXSA9PT0gMikpIHsgXyA9IDA7IGNvbnRpbnVlOyB9XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKG9wWzBdID09PSAzICYmICghdCB8fCAob3BbMV0gPiB0WzBdICYmIG9wWzFdIDwgdFszXSkpKSB7IF8ubGFiZWwgPSBvcFsxXTsgYnJlYWs7IH1cclxuICAgICAgICAgICAgICAgICAgICBpZiAob3BbMF0gPT09IDYgJiYgXy5sYWJlbCA8IHRbMV0pIHsgXy5sYWJlbCA9IHRbMV07IHQgPSBvcDsgYnJlYWs7IH1cclxuICAgICAgICAgICAgICAgICAgICBpZiAodCAmJiBfLmxhYmVsIDwgdFsyXSkgeyBfLmxhYmVsID0gdFsyXTsgXy5vcHMucHVzaChvcCk7IGJyZWFrOyB9XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKHRbMl0pIF8ub3BzLnBvcCgpO1xyXG4gICAgICAgICAgICAgICAgICAgIF8udHJ5cy5wb3AoKTsgY29udGludWU7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgb3AgPSBib2R5LmNhbGwodGhpc0FyZywgXyk7XHJcbiAgICAgICAgfSBjYXRjaCAoZSkgeyBvcCA9IFs2LCBlXTsgeSA9IDA7IH0gZmluYWxseSB7IGYgPSB0ID0gMDsgfVxyXG4gICAgICAgIGlmIChvcFswXSAmIDUpIHRocm93IG9wWzFdOyByZXR1cm4geyB2YWx1ZTogb3BbMF0gPyBvcFsxXSA6IHZvaWQgMCwgZG9uZTogdHJ1ZSB9O1xyXG4gICAgfVxyXG59XHJcblxyXG5leHBvcnQgdmFyIF9fY3JlYXRlQmluZGluZyA9IE9iamVjdC5jcmVhdGUgPyAoZnVuY3Rpb24obywgbSwgaywgazIpIHtcclxuICAgIGlmIChrMiA9PT0gdW5kZWZpbmVkKSBrMiA9IGs7XHJcbiAgICB2YXIgZGVzYyA9IE9iamVjdC5nZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3IobSwgayk7XHJcbiAgICBpZiAoIWRlc2MgfHwgKFwiZ2V0XCIgaW4gZGVzYyA/ICFtLl9fZXNNb2R1bGUgOiBkZXNjLndyaXRhYmxlIHx8IGRlc2MuY29uZmlndXJhYmxlKSkge1xyXG4gICAgICAgIGRlc2MgPSB7IGVudW1lcmFibGU6IHRydWUsIGdldDogZnVuY3Rpb24oKSB7IHJldHVybiBtW2tdOyB9IH07XHJcbiAgICB9XHJcbiAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkobywgazIsIGRlc2MpO1xyXG59KSA6IChmdW5jdGlvbihvLCBtLCBrLCBrMikge1xyXG4gICAgaWYgKGsyID09PSB1bmRlZmluZWQpIGsyID0gaztcclxuICAgIG9bazJdID0gbVtrXTtcclxufSk7XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19leHBvcnRTdGFyKG0sIG8pIHtcclxuICAgIGZvciAodmFyIHAgaW4gbSkgaWYgKHAgIT09IFwiZGVmYXVsdFwiICYmICFPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwobywgcCkpIF9fY3JlYXRlQmluZGluZyhvLCBtLCBwKTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fdmFsdWVzKG8pIHtcclxuICAgIHZhciBzID0gdHlwZW9mIFN5bWJvbCA9PT0gXCJmdW5jdGlvblwiICYmIFN5bWJvbC5pdGVyYXRvciwgbSA9IHMgJiYgb1tzXSwgaSA9IDA7XHJcbiAgICBpZiAobSkgcmV0dXJuIG0uY2FsbChvKTtcclxuICAgIGlmIChvICYmIHR5cGVvZiBvLmxlbmd0aCA9PT0gXCJudW1iZXJcIikgcmV0dXJuIHtcclxuICAgICAgICBuZXh0OiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgIGlmIChvICYmIGkgPj0gby5sZW5ndGgpIG8gPSB2b2lkIDA7XHJcbiAgICAgICAgICAgIHJldHVybiB7IHZhbHVlOiBvICYmIG9baSsrXSwgZG9uZTogIW8gfTtcclxuICAgICAgICB9XHJcbiAgICB9O1xyXG4gICAgdGhyb3cgbmV3IFR5cGVFcnJvcihzID8gXCJPYmplY3QgaXMgbm90IGl0ZXJhYmxlLlwiIDogXCJTeW1ib2wuaXRlcmF0b3IgaXMgbm90IGRlZmluZWQuXCIpO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19yZWFkKG8sIG4pIHtcclxuICAgIHZhciBtID0gdHlwZW9mIFN5bWJvbCA9PT0gXCJmdW5jdGlvblwiICYmIG9bU3ltYm9sLml0ZXJhdG9yXTtcclxuICAgIGlmICghbSkgcmV0dXJuIG87XHJcbiAgICB2YXIgaSA9IG0uY2FsbChvKSwgciwgYXIgPSBbXSwgZTtcclxuICAgIHRyeSB7XHJcbiAgICAgICAgd2hpbGUgKChuID09PSB2b2lkIDAgfHwgbi0tID4gMCkgJiYgIShyID0gaS5uZXh0KCkpLmRvbmUpIGFyLnB1c2goci52YWx1ZSk7XHJcbiAgICB9XHJcbiAgICBjYXRjaCAoZXJyb3IpIHsgZSA9IHsgZXJyb3I6IGVycm9yIH07IH1cclxuICAgIGZpbmFsbHkge1xyXG4gICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgIGlmIChyICYmICFyLmRvbmUgJiYgKG0gPSBpW1wicmV0dXJuXCJdKSkgbS5jYWxsKGkpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBmaW5hbGx5IHsgaWYgKGUpIHRocm93IGUuZXJyb3I7IH1cclxuICAgIH1cclxuICAgIHJldHVybiBhcjtcclxufVxyXG5cclxuLyoqIEBkZXByZWNhdGVkICovXHJcbmV4cG9ydCBmdW5jdGlvbiBfX3NwcmVhZCgpIHtcclxuICAgIGZvciAodmFyIGFyID0gW10sIGkgPSAwOyBpIDwgYXJndW1lbnRzLmxlbmd0aDsgaSsrKVxyXG4gICAgICAgIGFyID0gYXIuY29uY2F0KF9fcmVhZChhcmd1bWVudHNbaV0pKTtcclxuICAgIHJldHVybiBhcjtcclxufVxyXG5cclxuLyoqIEBkZXByZWNhdGVkICovXHJcbmV4cG9ydCBmdW5jdGlvbiBfX3NwcmVhZEFycmF5cygpIHtcclxuICAgIGZvciAodmFyIHMgPSAwLCBpID0gMCwgaWwgPSBhcmd1bWVudHMubGVuZ3RoOyBpIDwgaWw7IGkrKykgcyArPSBhcmd1bWVudHNbaV0ubGVuZ3RoO1xyXG4gICAgZm9yICh2YXIgciA9IEFycmF5KHMpLCBrID0gMCwgaSA9IDA7IGkgPCBpbDsgaSsrKVxyXG4gICAgICAgIGZvciAodmFyIGEgPSBhcmd1bWVudHNbaV0sIGogPSAwLCBqbCA9IGEubGVuZ3RoOyBqIDwgamw7IGorKywgaysrKVxyXG4gICAgICAgICAgICByW2tdID0gYVtqXTtcclxuICAgIHJldHVybiByO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19zcHJlYWRBcnJheSh0bywgZnJvbSwgcGFjaykge1xyXG4gICAgaWYgKHBhY2sgfHwgYXJndW1lbnRzLmxlbmd0aCA9PT0gMikgZm9yICh2YXIgaSA9IDAsIGwgPSBmcm9tLmxlbmd0aCwgYXI7IGkgPCBsOyBpKyspIHtcclxuICAgICAgICBpZiAoYXIgfHwgIShpIGluIGZyb20pKSB7XHJcbiAgICAgICAgICAgIGlmICghYXIpIGFyID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoZnJvbSwgMCwgaSk7XHJcbiAgICAgICAgICAgIGFyW2ldID0gZnJvbVtpXTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcbiAgICByZXR1cm4gdG8uY29uY2F0KGFyIHx8IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGZyb20pKTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fYXdhaXQodikge1xyXG4gICAgcmV0dXJuIHRoaXMgaW5zdGFuY2VvZiBfX2F3YWl0ID8gKHRoaXMudiA9IHYsIHRoaXMpIDogbmV3IF9fYXdhaXQodik7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX2FzeW5jR2VuZXJhdG9yKHRoaXNBcmcsIF9hcmd1bWVudHMsIGdlbmVyYXRvcikge1xyXG4gICAgaWYgKCFTeW1ib2wuYXN5bmNJdGVyYXRvcikgdGhyb3cgbmV3IFR5cGVFcnJvcihcIlN5bWJvbC5hc3luY0l0ZXJhdG9yIGlzIG5vdCBkZWZpbmVkLlwiKTtcclxuICAgIHZhciBnID0gZ2VuZXJhdG9yLmFwcGx5KHRoaXNBcmcsIF9hcmd1bWVudHMgfHwgW10pLCBpLCBxID0gW107XHJcbiAgICByZXR1cm4gaSA9IHt9LCB2ZXJiKFwibmV4dFwiKSwgdmVyYihcInRocm93XCIpLCB2ZXJiKFwicmV0dXJuXCIpLCBpW1N5bWJvbC5hc3luY0l0ZXJhdG9yXSA9IGZ1bmN0aW9uICgpIHsgcmV0dXJuIHRoaXM7IH0sIGk7XHJcbiAgICBmdW5jdGlvbiB2ZXJiKG4pIHsgaWYgKGdbbl0pIGlbbl0gPSBmdW5jdGlvbiAodikgeyByZXR1cm4gbmV3IFByb21pc2UoZnVuY3Rpb24gKGEsIGIpIHsgcS5wdXNoKFtuLCB2LCBhLCBiXSkgPiAxIHx8IHJlc3VtZShuLCB2KTsgfSk7IH07IH1cclxuICAgIGZ1bmN0aW9uIHJlc3VtZShuLCB2KSB7IHRyeSB7IHN0ZXAoZ1tuXSh2KSk7IH0gY2F0Y2ggKGUpIHsgc2V0dGxlKHFbMF1bM10sIGUpOyB9IH1cclxuICAgIGZ1bmN0aW9uIHN0ZXAocikgeyByLnZhbHVlIGluc3RhbmNlb2YgX19hd2FpdCA/IFByb21pc2UucmVzb2x2ZShyLnZhbHVlLnYpLnRoZW4oZnVsZmlsbCwgcmVqZWN0KSA6IHNldHRsZShxWzBdWzJdLCByKTsgfVxyXG4gICAgZnVuY3Rpb24gZnVsZmlsbCh2YWx1ZSkgeyByZXN1bWUoXCJuZXh0XCIsIHZhbHVlKTsgfVxyXG4gICAgZnVuY3Rpb24gcmVqZWN0KHZhbHVlKSB7IHJlc3VtZShcInRocm93XCIsIHZhbHVlKTsgfVxyXG4gICAgZnVuY3Rpb24gc2V0dGxlKGYsIHYpIHsgaWYgKGYodiksIHEuc2hpZnQoKSwgcS5sZW5ndGgpIHJlc3VtZShxWzBdWzBdLCBxWzBdWzFdKTsgfVxyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19hc3luY0RlbGVnYXRvcihvKSB7XHJcbiAgICB2YXIgaSwgcDtcclxuICAgIHJldHVybiBpID0ge30sIHZlcmIoXCJuZXh0XCIpLCB2ZXJiKFwidGhyb3dcIiwgZnVuY3Rpb24gKGUpIHsgdGhyb3cgZTsgfSksIHZlcmIoXCJyZXR1cm5cIiksIGlbU3ltYm9sLml0ZXJhdG9yXSA9IGZ1bmN0aW9uICgpIHsgcmV0dXJuIHRoaXM7IH0sIGk7XHJcbiAgICBmdW5jdGlvbiB2ZXJiKG4sIGYpIHsgaVtuXSA9IG9bbl0gPyBmdW5jdGlvbiAodikgeyByZXR1cm4gKHAgPSAhcCkgPyB7IHZhbHVlOiBfX2F3YWl0KG9bbl0odikpLCBkb25lOiBmYWxzZSB9IDogZiA/IGYodikgOiB2OyB9IDogZjsgfVxyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19hc3luY1ZhbHVlcyhvKSB7XHJcbiAgICBpZiAoIVN5bWJvbC5hc3luY0l0ZXJhdG9yKSB0aHJvdyBuZXcgVHlwZUVycm9yKFwiU3ltYm9sLmFzeW5jSXRlcmF0b3IgaXMgbm90IGRlZmluZWQuXCIpO1xyXG4gICAgdmFyIG0gPSBvW1N5bWJvbC5hc3luY0l0ZXJhdG9yXSwgaTtcclxuICAgIHJldHVybiBtID8gbS5jYWxsKG8pIDogKG8gPSB0eXBlb2YgX192YWx1ZXMgPT09IFwiZnVuY3Rpb25cIiA/IF9fdmFsdWVzKG8pIDogb1tTeW1ib2wuaXRlcmF0b3JdKCksIGkgPSB7fSwgdmVyYihcIm5leHRcIiksIHZlcmIoXCJ0aHJvd1wiKSwgdmVyYihcInJldHVyblwiKSwgaVtTeW1ib2wuYXN5bmNJdGVyYXRvcl0gPSBmdW5jdGlvbiAoKSB7IHJldHVybiB0aGlzOyB9LCBpKTtcclxuICAgIGZ1bmN0aW9uIHZlcmIobikgeyBpW25dID0gb1tuXSAmJiBmdW5jdGlvbiAodikgeyByZXR1cm4gbmV3IFByb21pc2UoZnVuY3Rpb24gKHJlc29sdmUsIHJlamVjdCkgeyB2ID0gb1tuXSh2KSwgc2V0dGxlKHJlc29sdmUsIHJlamVjdCwgdi5kb25lLCB2LnZhbHVlKTsgfSk7IH07IH1cclxuICAgIGZ1bmN0aW9uIHNldHRsZShyZXNvbHZlLCByZWplY3QsIGQsIHYpIHsgUHJvbWlzZS5yZXNvbHZlKHYpLnRoZW4oZnVuY3Rpb24odikgeyByZXNvbHZlKHsgdmFsdWU6IHYsIGRvbmU6IGQgfSk7IH0sIHJlamVjdCk7IH1cclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fbWFrZVRlbXBsYXRlT2JqZWN0KGNvb2tlZCwgcmF3KSB7XHJcbiAgICBpZiAoT2JqZWN0LmRlZmluZVByb3BlcnR5KSB7IE9iamVjdC5kZWZpbmVQcm9wZXJ0eShjb29rZWQsIFwicmF3XCIsIHsgdmFsdWU6IHJhdyB9KTsgfSBlbHNlIHsgY29va2VkLnJhdyA9IHJhdzsgfVxyXG4gICAgcmV0dXJuIGNvb2tlZDtcclxufTtcclxuXHJcbnZhciBfX3NldE1vZHVsZURlZmF1bHQgPSBPYmplY3QuY3JlYXRlID8gKGZ1bmN0aW9uKG8sIHYpIHtcclxuICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShvLCBcImRlZmF1bHRcIiwgeyBlbnVtZXJhYmxlOiB0cnVlLCB2YWx1ZTogdiB9KTtcclxufSkgOiBmdW5jdGlvbihvLCB2KSB7XHJcbiAgICBvW1wiZGVmYXVsdFwiXSA9IHY7XHJcbn07XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19pbXBvcnRTdGFyKG1vZCkge1xyXG4gICAgaWYgKG1vZCAmJiBtb2QuX19lc01vZHVsZSkgcmV0dXJuIG1vZDtcclxuICAgIHZhciByZXN1bHQgPSB7fTtcclxuICAgIGlmIChtb2QgIT0gbnVsbCkgZm9yICh2YXIgayBpbiBtb2QpIGlmIChrICE9PSBcImRlZmF1bHRcIiAmJiBPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwobW9kLCBrKSkgX19jcmVhdGVCaW5kaW5nKHJlc3VsdCwgbW9kLCBrKTtcclxuICAgIF9fc2V0TW9kdWxlRGVmYXVsdChyZXN1bHQsIG1vZCk7XHJcbiAgICByZXR1cm4gcmVzdWx0O1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gX19pbXBvcnREZWZhdWx0KG1vZCkge1xyXG4gICAgcmV0dXJuIChtb2QgJiYgbW9kLl9fZXNNb2R1bGUpID8gbW9kIDogeyBkZWZhdWx0OiBtb2QgfTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fY2xhc3NQcml2YXRlRmllbGRHZXQocmVjZWl2ZXIsIHN0YXRlLCBraW5kLCBmKSB7XHJcbiAgICBpZiAoa2luZCA9PT0gXCJhXCIgJiYgIWYpIHRocm93IG5ldyBUeXBlRXJyb3IoXCJQcml2YXRlIGFjY2Vzc29yIHdhcyBkZWZpbmVkIHdpdGhvdXQgYSBnZXR0ZXJcIik7XHJcbiAgICBpZiAodHlwZW9mIHN0YXRlID09PSBcImZ1bmN0aW9uXCIgPyByZWNlaXZlciAhPT0gc3RhdGUgfHwgIWYgOiAhc3RhdGUuaGFzKHJlY2VpdmVyKSkgdGhyb3cgbmV3IFR5cGVFcnJvcihcIkNhbm5vdCByZWFkIHByaXZhdGUgbWVtYmVyIGZyb20gYW4gb2JqZWN0IHdob3NlIGNsYXNzIGRpZCBub3QgZGVjbGFyZSBpdFwiKTtcclxuICAgIHJldHVybiBraW5kID09PSBcIm1cIiA/IGYgOiBraW5kID09PSBcImFcIiA/IGYuY2FsbChyZWNlaXZlcikgOiBmID8gZi52YWx1ZSA6IHN0YXRlLmdldChyZWNlaXZlcik7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBfX2NsYXNzUHJpdmF0ZUZpZWxkU2V0KHJlY2VpdmVyLCBzdGF0ZSwgdmFsdWUsIGtpbmQsIGYpIHtcclxuICAgIGlmIChraW5kID09PSBcIm1cIikgdGhyb3cgbmV3IFR5cGVFcnJvcihcIlByaXZhdGUgbWV0aG9kIGlzIG5vdCB3cml0YWJsZVwiKTtcclxuICAgIGlmIChraW5kID09PSBcImFcIiAmJiAhZikgdGhyb3cgbmV3IFR5cGVFcnJvcihcIlByaXZhdGUgYWNjZXNzb3Igd2FzIGRlZmluZWQgd2l0aG91dCBhIHNldHRlclwiKTtcclxuICAgIGlmICh0eXBlb2Ygc3RhdGUgPT09IFwiZnVuY3Rpb25cIiA/IHJlY2VpdmVyICE9PSBzdGF0ZSB8fCAhZiA6ICFzdGF0ZS5oYXMocmVjZWl2ZXIpKSB0aHJvdyBuZXcgVHlwZUVycm9yKFwiQ2Fubm90IHdyaXRlIHByaXZhdGUgbWVtYmVyIHRvIGFuIG9iamVjdCB3aG9zZSBjbGFzcyBkaWQgbm90IGRlY2xhcmUgaXRcIik7XHJcbiAgICByZXR1cm4gKGtpbmQgPT09IFwiYVwiID8gZi5jYWxsKHJlY2VpdmVyLCB2YWx1ZSkgOiBmID8gZi52YWx1ZSA9IHZhbHVlIDogc3RhdGUuc2V0KHJlY2VpdmVyLCB2YWx1ZSkpLCB2YWx1ZTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIF9fY2xhc3NQcml2YXRlRmllbGRJbihzdGF0ZSwgcmVjZWl2ZXIpIHtcclxuICAgIGlmIChyZWNlaXZlciA9PT0gbnVsbCB8fCAodHlwZW9mIHJlY2VpdmVyICE9PSBcIm9iamVjdFwiICYmIHR5cGVvZiByZWNlaXZlciAhPT0gXCJmdW5jdGlvblwiKSkgdGhyb3cgbmV3IFR5cGVFcnJvcihcIkNhbm5vdCB1c2UgJ2luJyBvcGVyYXRvciBvbiBub24tb2JqZWN0XCIpO1xyXG4gICAgcmV0dXJuIHR5cGVvZiBzdGF0ZSA9PT0gXCJmdW5jdGlvblwiID8gcmVjZWl2ZXIgPT09IHN0YXRlIDogc3RhdGUuaGFzKHJlY2VpdmVyKTtcclxufVxyXG4iLCJpbXBvcnQgeyBub3RFcXVhbCB9IGZyb20gXCJhc3NlcnRcIjtcclxuaW1wb3J0IHsgZXhlYyB9IGZyb20gXCJjaGlsZF9wcm9jZXNzXCI7XHJcbmltcG9ydCB7IFxyXG4gIEVkaXRvciwgXHJcbiAgRWRpdG9yUG9zaXRpb24sIFxyXG4gIEVkaXRvclN1Z2dlc3QsIFxyXG4gIEVkaXRvclN1Z2dlc3RDb250ZXh0LFxyXG4gIEVkaXRvclN1Z2dlc3RUcmlnZ2VySW5mbyxcclxuICBNYXJrZG93blZpZXcsIFxyXG4gIFBsdWdpbiBcclxufSBmcm9tIFwib2JzaWRpYW5cIjtcclxuXHJcbmltcG9ydCB7IEN1cnNvclBvcywgY2xlYXJTY3JlZW5Eb3duIH0gZnJvbSBcInJlYWRsaW5lXCI7XHJcblxyXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBNeVBsdWdpbiBleHRlbmRzIFBsdWdpbiB7XHJcbiAgLy9wcml2YXRlIGRldGFpbExpbmVSZWdleCA9IC9cXFtcXF4oXFxkKylcXF1cXDovO1xyXG4gIHByaXZhdGUgTnVtUmVPbmx5TWFya2VycyA9IC9cXFtcXF4oXFxkKylcXF0vZ2k7XHJcbiAgLy9wcml2YXRlIG51bWVyaWNhbFJlID0gLyhcXGQrKS87XHJcblxyXG4gIHByaXZhdGUgTmFtZWREZXRhaWxMaW5lUmVnZXggPSAvXFxbXFxeKFteXFxbXFxdXSspXFxdOi87XHJcbiAgcHJpdmF0ZSBOYW1lZEFsbERldGFpbHMgPSAvXFxbXFxeKFteXFxbXFxdXSspXFxdOi9nO1xyXG4gIHByaXZhdGUgTmFtZWRSZU9ubHlNYXJrZXJzID0gL1xcW1xcXihbXlxcW1xcXV0rKVxcXSg/ITopL2RnO1xyXG4gIHByaXZhdGUgTmFtZWRSZSA9IC8oPzw9XFxbXFxeKShbXlxcW1xcXV0rKSg/PVxcXSkvO1xyXG5cclxuICBhc3luYyBvbmxvYWQoKSB7XHJcbiAgICB0aGlzLmFkZENvbW1hbmQoe1xyXG4gICAgICBpZDogXCJpbnNlcnQtYXV0b251bWJlcmVkLWZvb3Rub3RlXCIsXHJcbiAgICAgIG5hbWU6IFwiSW5zZXJ0IC8gTmF2aWdhdGUgQXV0by1OdW1iZXJlZCBGb290bm90ZVwiLFxyXG4gICAgICBjaGVja0NhbGxiYWNrOiAoY2hlY2tpbmc6IGJvb2xlYW4pID0+IHtcclxuICAgICAgICBpZiAoY2hlY2tpbmcpXHJcbiAgICAgICAgICByZXR1cm4gISF0aGlzLmFwcC53b3Jrc3BhY2UuZ2V0QWN0aXZlVmlld09mVHlwZShNYXJrZG93blZpZXcpO1xyXG4gICAgICAgIHRoaXMuaW5zZXJ0QXV0b251bUZvb3Rub3RlKCk7XHJcbiAgICAgIH0sXHJcbiAgICB9KTtcclxuICAgIHRoaXMuYWRkQ29tbWFuZCh7XHJcbiAgICAgIGlkOiBcImluc2VydC1uYW1lZC1mb290bm90ZVwiLFxyXG4gICAgICBuYW1lOiBcIkluc2VydCAvIE5hdmlnYXRlIE5hbWVkIEZvb3Rub3RlXCIsXHJcbiAgICAgIGNoZWNrQ2FsbGJhY2s6IChjaGVja2luZzogYm9vbGVhbikgPT4ge1xyXG4gICAgICAgIGlmIChjaGVja2luZylcclxuICAgICAgICAgIHJldHVybiAhIXRoaXMuYXBwLndvcmtzcGFjZS5nZXRBY3RpdmVWaWV3T2ZUeXBlKE1hcmtkb3duVmlldyk7XHJcbiAgICAgICAgdGhpcy5pbnNlcnROYW1lZEZvb3Rub3RlKCk7XHJcbiAgICAgIH1cclxuICAgIH0pO1xyXG4gICAgLyp0aGlzLmFkZENvbW1hbmQoe1xyXG4gICAgICBpZDogXCJQb3B1cFwiLFxyXG4gICAgICBuYW1lOiBcIlBvcHVwXCIsXHJcbiAgICAgIGNoZWNrQ2FsbGJhY2s6IChjaGVja2luZzogYm9vbGVhbikgPT4ge1xyXG4gICAgICAgIGlmIChjaGVja2luZylcclxuICAgICAgICAgIHJldHVybiAhIXRoaXMuYXBwLndvcmtzcGFjZS5nZXRBY3RpdmVWaWV3T2ZUeXBlKE1hcmtkb3duVmlldylcclxuICAgICAgICB0aGlzLmZvb3Rub3RlUGlja2VyKCk7XHJcbiAgICAgIH1cclxuICAgIH0pOyovXHJcbiAgfVxyXG5cclxuICBwcml2YXRlIGxpc3RFeGlzdGluZ0Zvb3Rub3RlRGV0YWlscyhcclxuICAgIGRvYzogRWRpdG9yXHJcbiAgKSB7XHJcbiAgICBsZXQgRm9vdG5vdGVEZXRhaWxMaXN0OiBzdHJpbmdbXSA9IFtdO1xyXG4gICAgXHJcbiAgICAvL3NlYXJjaCBlYWNoIGxpbmUgZm9yIGZvb3Rub3RlIGRldGFpbHMgYW5kIGFkZCB0byBsaXN0XHJcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGRvYy5saW5lQ291bnQoKTsgaSsrKSB7XHJcbiAgICAgICAgICBsZXQgdGhlTGluZSA9IGRvYy5nZXRMaW5lKGkpO1xyXG4gICAgICAgICAgbGV0IGxpbmVNYXRjaCA9IHRoZUxpbmUubWF0Y2godGhpcy5OYW1lZEFsbERldGFpbHMpO1xyXG4gICAgICAgICAgaWYgKGxpbmVNYXRjaCkge1xyXG4gICAgICAgICAgICBsZXQgdGVtcCA9IGxpbmVNYXRjaFswXTtcclxuICAgICAgICAgICAgdGVtcCA9IHRlbXAucmVwbGFjZShcIlteXCIsXCJcIik7XHJcbiAgICAgICAgICAgIHRlbXAgPSB0ZW1wLnJlcGxhY2UoXCJdOlwiLFwiXCIpO1xyXG5cclxuICAgICAgICAgICAgRm9vdG5vdGVEZXRhaWxMaXN0LnB1c2godGVtcCk7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgaWYgKEZvb3Rub3RlRGV0YWlsTGlzdC5sZW5ndGggPiAwKSB7XHJcbiAgICAgIHJldHVybiBGb290bm90ZURldGFpbExpc3Q7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICByZXR1cm4gbnVsbDtcclxuICAgIH1cclxuICB9XHJcblxyXG4gIHByaXZhdGUgbGlzdEV4aXN0aW5nRm9vdG5vdGVNYXJrZXJzQW5kTG9jYXRpb25zKFxyXG4gICAgZG9jOiBFZGl0b3JcclxuICApIHtcclxuICAgIHR5cGUgbWFya2VyRW50cnkgPSB7XHJcbiAgICAgIGZvb3Rub3RlOiBzdHJpbmc7XHJcbiAgICAgIGxpbmVOdW06IG51bWJlcjtcclxuICAgICAgc3RhcnRJbmRleDogbnVtYmVyO1xyXG4gICAgfVxyXG4gICAgbGV0IG1hcmtlckVudHJ5O1xyXG5cclxuICAgIGxldCBGb290bm90ZU1hcmtlckluZm8gPSBbXTtcclxuICAgIC8vc2VhcmNoIGVhY2ggbGluZSBmb3IgZm9vdG5vdGUgbWFya2Vyc1xyXG4gICAgLy9mb3IgZWFjaCwgYWRkIHRoZWlyIG5hbWUsIGxpbmUgbnVtYmVyLCBhbmQgc3RhcnQgaW5kZXggdG8gRm9vdG5vdGVNYXJrZXJJbmZvXHJcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGRvYy5saW5lQ291bnQoKTsgaSsrKSB7XHJcbiAgICAgIGxldCB0aGVMaW5lID0gZG9jLmdldExpbmUoaSk7XHJcbiAgICAgIGxldCBsaW5lTWF0Y2g7XHJcblxyXG4gICAgICB3aGlsZSAoKGxpbmVNYXRjaCA9IHRoaXMuTmFtZWRSZU9ubHlNYXJrZXJzLmV4ZWModGhlTGluZSkpICE9IG51bGwpIHtcclxuICAgICAgICBtYXJrZXJFbnRyeSA9IHtcclxuICAgICAgICAgIGZvb3Rub3RlOiBsaW5lTWF0Y2hbMF0sXHJcbiAgICAgICAgICBsaW5lTnVtOiBpLFxyXG4gICAgICAgICAgc3RhcnRJbmRleDogbGluZU1hdGNoLmluZGV4XHJcbiAgICAgICAgfVxyXG4gICAgICAgIEZvb3Rub3RlTWFya2VySW5mby5wdXNoKG1hcmtlckVudHJ5KTtcclxuICAgICAgfVxyXG4gICAgfVxyXG4gICAgcmV0dXJuIEZvb3Rub3RlTWFya2VySW5mbztcclxuICB9XHJcbiAgXHJcbiAgaW5zZXJ0QXV0b251bUZvb3Rub3RlKCkge1xyXG4gICAgY29uc3QgbWRWaWV3ID0gdGhpcy5hcHAud29ya3NwYWNlLmdldEFjdGl2ZVZpZXdPZlR5cGUoTWFya2Rvd25WaWV3KTtcclxuXHJcbiAgICBpZiAoIW1kVmlldykgcmV0dXJuIGZhbHNlO1xyXG4gICAgaWYgKG1kVmlldy5lZGl0b3IgPT0gdW5kZWZpbmVkKSByZXR1cm4gZmFsc2U7XHJcblxyXG4gICAgY29uc3QgZG9jID0gbWRWaWV3LmVkaXRvcjtcclxuICAgIGNvbnN0IGN1cnNvclBvc2l0aW9uID0gZG9jLmdldEN1cnNvcigpO1xyXG4gICAgY29uc3QgbGluZVRleHQgPSBkb2MuZ2V0TGluZShjdXJzb3JQb3NpdGlvbi5saW5lKTtcclxuICAgIGNvbnN0IG1hcmtkb3duVGV4dCA9IG1kVmlldy5kYXRhO1xyXG5cclxuICAgIGlmICh0aGlzLnNob3VsZEp1bXBGcm9tRGV0YWlsVG9NYXJrZXIobGluZVRleHQsIGN1cnNvclBvc2l0aW9uLCBkb2MpKVxyXG4gICAgICByZXR1cm47XHJcbiAgICBpZiAodGhpcy5zaG91bGRKdW1wRnJvbU1hcmtlclRvRGV0YWlsKGxpbmVUZXh0LCBjdXJzb3JQb3NpdGlvbiwgZG9jKSlcclxuICAgICAgcmV0dXJuO1xyXG5cclxuICAgIHJldHVybiB0aGlzLnNob3VsZENyZWF0ZUF1dG9udW1Gb290bm90ZShcclxuICAgICAgbGluZVRleHQsXHJcbiAgICAgIGN1cnNvclBvc2l0aW9uLFxyXG4gICAgICBkb2MsXHJcbiAgICAgIG1hcmtkb3duVGV4dFxyXG4gICAgKTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgc2hvdWxkSnVtcEZyb21EZXRhaWxUb01hcmtlcihcclxuICAgIGxpbmVUZXh0OiBzdHJpbmcsXHJcbiAgICBjdXJzb3JQb3NpdGlvbjogRWRpdG9yUG9zaXRpb24sXHJcbiAgICBkb2M6IEVkaXRvclxyXG4gICkge1xyXG4gICAgLy8gY2hlY2sgaWYgd2UncmUgaW4gYSBmb290bm90ZSBkZXRhaWwgbGluZSAoXCJbXjFdOiBmb290bm90ZVwiKVxyXG4gICAgLy8gaWYgc28sIGp1bXAgY3Vyc29yIGJhY2sgdG8gdGhlIGZvb3Rub3RlIGluIHRoZSB0ZXh0XHJcbiAgICAvLyBodHRwczovL2dpdGh1Yi5jb20vYWthYWxpYXMvb2JzaWRpYW4tZm9vdG5vdGVzI2ltcHJvdmVkLXF1aWNrLW5hdmlnYXRpb25cclxuICAgIGxldCBtYXRjaCA9IGxpbmVUZXh0Lm1hdGNoKHRoaXMuTmFtZWREZXRhaWxMaW5lUmVnZXgpO1xyXG4gICAgaWYgKG1hdGNoKSB7XHJcbiAgICAgIGxldCBzID0gbWF0Y2hbMF07XHJcbiAgICAgIGxldCBpbmRleCA9IHMucmVwbGFjZShcIlteXCIsIFwiXCIpO1xyXG4gICAgICBpbmRleCA9IGluZGV4LnJlcGxhY2UoXCJdOlwiLCBcIlwiKTtcclxuICAgICAgbGV0IGZvb3Rub3RlID0gcy5yZXBsYWNlKFwiOlwiLCBcIlwiKTtcclxuXHJcbiAgICAgIGxldCByZXR1cm5MaW5lSW5kZXggPSBjdXJzb3JQb3NpdGlvbi5saW5lO1xyXG4gICAgICAvLyBmaW5kIHRoZSBGSVJTVCBPQ0NVUkVOQ0Ugd2hlcmUgdGhpcyBmb290bm90ZSBleGlzdHMgaW4gdGhlIHRleHRcclxuICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBkb2MubGluZUNvdW50KCk7IGkrKykge1xyXG4gICAgICAgIGxldCBzY2FuTGluZSA9IGRvYy5nZXRMaW5lKGkpO1xyXG4gICAgICAgIGlmIChzY2FuTGluZS5jb250YWlucyhmb290bm90ZSkpIHtcclxuICAgICAgICAgIGxldCBjdXJzb3JMb2NhdGlvbkluZGV4ID0gc2NhbkxpbmUuaW5kZXhPZihmb290bm90ZSk7XHJcbiAgICAgICAgICByZXR1cm5MaW5lSW5kZXggPSBpO1xyXG4gICAgICAgICAgZG9jLnNldEN1cnNvcih7XHJcbiAgICAgICAgICAgIGxpbmU6IHJldHVybkxpbmVJbmRleCxcclxuICAgICAgICAgICAgY2g6IGN1cnNvckxvY2F0aW9uSW5kZXggKyBmb290bm90ZS5sZW5ndGgsXHJcbiAgICAgICAgICB9KTtcclxuICAgICAgICAgIHJldHVybiB0cnVlO1xyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIHJldHVybiBmYWxzZTtcclxuICB9XHJcblxyXG4gIHByaXZhdGUgc2hvdWxkSnVtcEZyb21NYXJrZXJUb0RldGFpbChcclxuICAgIGxpbmVUZXh0OiBzdHJpbmcsXHJcbiAgICBjdXJzb3JQb3NpdGlvbjogRWRpdG9yUG9zaXRpb24sXHJcbiAgICBkb2M6IEVkaXRvclxyXG4gICkge1xyXG4gICAgLy8gSnVtcCBjdXJzb3IgVE8gZGV0YWlsIG1hcmtlclxyXG5cclxuICAgIC8vIGRvZXMgdGhpcyBsaW5lIGhhdmUgYSBmb290bm90ZSBtYXJrZXI/XHJcbiAgICAvLyBkb2VzIHRoZSBjdXJzb3Igb3ZlcmxhcCB3aXRoIG9uZSBvZiB0aGVtP1xyXG4gICAgLy8gaWYgc28sIHdoaWNoIG9uZT9cclxuICAgIC8vIGZpbmQgdGhpcyBmb290bm90ZSBtYXJrZXIncyBkZXRhaWwgbGluZVxyXG4gICAgLy8gcGxhY2UgY3Vyc29yIHRoZXJlXHJcbiAgICBsZXQgbWFya2VyVGFyZ2V0ID0gbnVsbDtcclxuXHJcbiAgICBsZXQgRm9vdG5vdGVNYXJrZXJJbmZvID0gdGhpcy5saXN0RXhpc3RpbmdGb290bm90ZU1hcmtlcnNBbmRMb2NhdGlvbnMoZG9jKTtcclxuICAgIGxldCBjdXJyZW50TGluZSA9IGN1cnNvclBvc2l0aW9uLmxpbmU7XHJcbiAgICBsZXQgZm9vdG5vdGVzT25MaW5lID0gRm9vdG5vdGVNYXJrZXJJbmZvLmZpbHRlcihtYXJrZXJFbnRyeSA9PiBtYXJrZXJFbnRyeS5saW5lTnVtID09PSBjdXJyZW50TGluZSk7XHJcblxyXG4gICAgaWYgKGZvb3Rub3Rlc09uTGluZSAhPSBudWxsICYmIChmb290bm90ZXNPbkxpbmUubGVuZ3RoLTEgPiAwKSkge1xyXG4gICAgICBmb3IgKGxldCBpID0gMDsgaSA8PSBmb290bm90ZXNPbkxpbmUubGVuZ3RoLTE7IGkrKykge1xyXG4gICAgICAgIGlmIChmb290bm90ZXNPbkxpbmVbaV0uZm9vdG5vdGUgIT09IG51bGwpIHtcclxuICAgICAgICAgIGxldCBtYXJrZXIgPSBmb290bm90ZXNPbkxpbmVbaV0uZm9vdG5vdGU7XHJcbiAgICAgICAgICBsZXQgaW5kZXhPZk1hcmtlckluTGluZSA9IGZvb3Rub3Rlc09uTGluZVtpXS5zdGFydEluZGV4O1xyXG4gICAgICAgICAgaWYgKFxyXG4gICAgICAgICAgICBjdXJzb3JQb3NpdGlvbi5jaCA+PSBpbmRleE9mTWFya2VySW5MaW5lICYmXHJcbiAgICAgICAgICAgIGN1cnNvclBvc2l0aW9uLmNoIDw9IGluZGV4T2ZNYXJrZXJJbkxpbmUgKyBtYXJrZXIubGVuZ3RoXHJcbiAgICAgICAgICApIHtcclxuICAgICAgICAgICAgbWFya2VyVGFyZ2V0ID0gbWFya2VyO1xyXG4gICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgIH1cclxuICAgIH1cclxuICAgIGlmIChtYXJrZXJUYXJnZXQgIT09IG51bGwpIHtcclxuICAgICAgLy8gZXh0cmFjdCBpbmRleFxyXG4gICAgICBsZXQgbWF0Y2ggPSBtYXJrZXJUYXJnZXQubWF0Y2godGhpcy5OYW1lZFJlKTtcclxuICAgICAgaWYgKG1hdGNoKSB7XHJcbiAgICAgICAgbGV0IGluZGV4U3RyaW5nID0gbWF0Y2hbMF07XHJcbiAgICAgICAgLy9sZXQgbWFya2VySW5kZXggPSBOdW1iZXIoaW5kZXhTdHJpbmcpO1xyXG5cclxuICAgICAgICAvLyBmaW5kIHRoZSBmaXJzdCBsaW5lIHdpdGggdGhpcyBkZXRhaWwgbWFya2VyIGluZGV4IGluIGl0LlxyXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgZG9jLmxpbmVDb3VudCgpOyBpKyspIHtcclxuICAgICAgICAgIGxldCB0aGVMaW5lID0gZG9jLmdldExpbmUoaSk7XHJcbiAgICAgICAgICBsZXQgbGluZU1hdGNoID0gdGhlTGluZS5tYXRjaCh0aGlzLk5hbWVkRGV0YWlsTGluZVJlZ2V4KTtcclxuICAgICAgICAgIGlmIChsaW5lTWF0Y2gpIHtcclxuICAgICAgICAgICAgLy8gY29tcGFyZSB0byB0aGUgaW5kZXhcclxuICAgICAgICAgICAgbGV0IGluZGV4TWF0Y2ggPSBsaW5lTWF0Y2hbMV07XHJcbiAgICAgICAgICAgIC8vbGV0IGluZGV4TWF0Y2hOdW1iZXIgPSBOdW1iZXIoaW5kZXhNYXRjaCk7XHJcbiAgICAgICAgICAgIGlmIChpbmRleE1hdGNoID09IGluZGV4U3RyaW5nKSB7XHJcbiAgICAgICAgICAgICAgZG9jLnNldEN1cnNvcih7IGxpbmU6IGksIGNoOiBsaW5lTWF0Y2hbMF0ubGVuZ3RoICsgMSB9KTtcclxuICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG4gICAgfVxyXG4gICAgcmV0dXJuIGZhbHNlO1xyXG4gIH1cclxuXHJcbiAgcHJpdmF0ZSBzaG91bGRDcmVhdGVBdXRvbnVtRm9vdG5vdGUoXHJcbiAgICBsaW5lVGV4dDogc3RyaW5nLFxyXG4gICAgY3Vyc29yUG9zaXRpb246IEVkaXRvclBvc2l0aW9uLFxyXG4gICAgZG9jOiBFZGl0b3IsXHJcbiAgICBtYXJrZG93blRleHQ6IHN0cmluZ1xyXG4gICkge1xyXG4gICAgLy8gY3JlYXRlIG5ldyBmb290bm90ZSB3aXRoIHRoZSBuZXh0IG51bWVyaWNhbCBpbmRleFxyXG4gICAgbGV0IG1hdGNoZXMgPSBtYXJrZG93blRleHQubWF0Y2godGhpcy5OdW1SZU9ubHlNYXJrZXJzKTtcclxuICAgIGxldCBudW1iZXJzOiBBcnJheTxudW1iZXI+ID0gW107XHJcbiAgICBsZXQgY3VycmVudE1heCA9IDE7XHJcblxyXG4gICAgaWYgKG1hdGNoZXMgIT0gbnVsbCkge1xyXG4gICAgICBmb3IgKGxldCBpID0gMDsgaSA8PSBtYXRjaGVzLmxlbmd0aCAtIDE7IGkrKykge1xyXG4gICAgICAgIGxldCBtYXRjaCA9IG1hdGNoZXNbaV07XHJcbiAgICAgICAgbWF0Y2ggPSBtYXRjaC5yZXBsYWNlKFwiW15cIiwgXCJcIik7XHJcbiAgICAgICAgbWF0Y2ggPSBtYXRjaC5yZXBsYWNlKFwiXVwiLCBcIlwiKTtcclxuICAgICAgICBsZXQgbWF0Y2hOdW1iZXIgPSBOdW1iZXIobWF0Y2gpO1xyXG4gICAgICAgIG51bWJlcnNbaV0gPSBtYXRjaE51bWJlcjtcclxuICAgICAgICBpZiAobWF0Y2hOdW1iZXIgKyAxID4gY3VycmVudE1heCkge1xyXG4gICAgICAgICAgY3VycmVudE1heCA9IG1hdGNoTnVtYmVyICsgMTtcclxuICAgICAgICB9XHJcbiAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBsZXQgZm9vdE5vdGVJZCA9IGN1cnJlbnRNYXg7XHJcbiAgICBsZXQgZm9vdG5vdGVNYXJrZXIgPSBgW14ke2Zvb3ROb3RlSWR9XWA7XHJcbiAgICBsZXQgbGluZVBhcnQxID0gbGluZVRleHQuc3Vic3RyKDAsIGN1cnNvclBvc2l0aW9uLmNoKTtcclxuICAgIGxldCBsaW5lUGFydDIgPSBsaW5lVGV4dC5zdWJzdHIoY3Vyc29yUG9zaXRpb24uY2gpO1xyXG4gICAgbGV0IG5ld0xpbmUgPSBsaW5lUGFydDEgKyBmb290bm90ZU1hcmtlciArIGxpbmVQYXJ0MjtcclxuXHJcbiAgICBkb2MucmVwbGFjZVJhbmdlKFxyXG4gICAgICBuZXdMaW5lLFxyXG4gICAgICB7IGxpbmU6IGN1cnNvclBvc2l0aW9uLmxpbmUsIGNoOiAwIH0sXHJcbiAgICAgIHsgbGluZTogY3Vyc29yUG9zaXRpb24ubGluZSwgY2g6IGxpbmVUZXh0Lmxlbmd0aCB9XHJcbiAgICApO1xyXG5cclxuICAgIGxldCBsYXN0TGluZUluZGV4ID0gZG9jLmxhc3RMaW5lKCk7XHJcbiAgICBsZXQgbGFzdExpbmUgPSBkb2MuZ2V0TGluZShsYXN0TGluZUluZGV4KTtcclxuXHJcbiAgICB3aGlsZSAobGFzdExpbmVJbmRleCA+IDApIHtcclxuICAgICAgbGFzdExpbmUgPSBkb2MuZ2V0TGluZShsYXN0TGluZUluZGV4KTtcclxuICAgICAgaWYgKGxhc3RMaW5lLmxlbmd0aCA+IDApIHtcclxuICAgICAgICBkb2MucmVwbGFjZVJhbmdlKFxyXG4gICAgICAgICAgXCJcIixcclxuICAgICAgICAgIHsgbGluZTogbGFzdExpbmVJbmRleCwgY2g6IDAgfSxcclxuICAgICAgICAgIHsgbGluZTogZG9jLmxhc3RMaW5lKCksIGNoOiAwIH1cclxuICAgICAgICApO1xyXG4gICAgICAgIGJyZWFrO1xyXG4gICAgICB9XHJcbiAgICAgIGxhc3RMaW5lSW5kZXgtLTtcclxuICAgIH1cclxuXHJcbiAgICBsZXQgZm9vdG5vdGVEZXRhaWwgPSBgXFxuW14ke2Zvb3ROb3RlSWR9XTogYDtcclxuXHJcbiAgICBsZXQgbGlzdCA9IHRoaXMubGlzdEV4aXN0aW5nRm9vdG5vdGVEZXRhaWxzKGRvYyk7XHJcbiAgICBcclxuICAgIGlmIChsaXN0PT09bnVsbCAmJiBjdXJyZW50TWF4ID09IDEpIHtcclxuICAgICAgZm9vdG5vdGVEZXRhaWwgPSBcIlxcblwiICsgZm9vdG5vdGVEZXRhaWw7XHJcbiAgICAgIGRvYy5zZXRMaW5lKGRvYy5sYXN0TGluZSgpLCBsYXN0TGluZSArIGZvb3Rub3RlRGV0YWlsKTtcclxuICAgICAgZG9jLnNldEN1cnNvcihkb2MubGFzdExpbmUoKSAtIDEsIGZvb3Rub3RlRGV0YWlsLmxlbmd0aCAtIDEpO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgZG9jLnNldExpbmUoZG9jLmxhc3RMaW5lKCksIGxhc3RMaW5lICsgZm9vdG5vdGVEZXRhaWwpO1xyXG4gICAgICBkb2Muc2V0Q3Vyc29yKGRvYy5sYXN0TGluZSgpLCBmb290bm90ZURldGFpbC5sZW5ndGggLSAxKTtcclxuICAgIH1cclxuICB9XHJcblxyXG5cclxuICAvLyBGdW5jdGlvbnMgZm9yIE5hbWVkIEZvb3Rub3Rlc1xyXG5cclxuXHJcbiAgaW5zZXJ0TmFtZWRGb290bm90ZSgpIHtcclxuICAgIGNvbnN0IG1kVmlldyA9IHRoaXMuYXBwLndvcmtzcGFjZS5nZXRBY3RpdmVWaWV3T2ZUeXBlKE1hcmtkb3duVmlldyk7XHJcblxyXG4gICAgaWYgKCFtZFZpZXcpIHJldHVybiBmYWxzZTtcclxuICAgIGlmIChtZFZpZXcuZWRpdG9yID09IHVuZGVmaW5lZCkgcmV0dXJuIGZhbHNlO1xyXG5cclxuICAgIGNvbnN0IGRvYyA9IG1kVmlldy5lZGl0b3I7XHJcbiAgICBjb25zdCBjdXJzb3JQb3NpdGlvbiA9IGRvYy5nZXRDdXJzb3IoKTtcclxuICAgIGNvbnN0IGxpbmVUZXh0ID0gZG9jLmdldExpbmUoY3Vyc29yUG9zaXRpb24ubGluZSk7XHJcbiAgICBjb25zdCBtYXJrZG93blRleHQgPSBtZFZpZXcuZGF0YTtcclxuXHJcbiAgICBpZiAodGhpcy5zaG91bGRKdW1wRnJvbURldGFpbFRvTWFya2VyKGxpbmVUZXh0LCBjdXJzb3JQb3NpdGlvbiwgZG9jKSlcclxuICAgICAgcmV0dXJuO1xyXG4gICAgaWYgKHRoaXMuc2hvdWxkSnVtcEZyb21NYXJrZXJUb0RldGFpbChsaW5lVGV4dCwgY3Vyc29yUG9zaXRpb24sIGRvYykpXHJcbiAgICAgIHJldHVybjtcclxuXHJcbiAgICBpZiAodGhpcy5zaG91bGRDcmVhdGVNYXRjaGluZ0Zvb3Rub3RlRGV0YWlsKGxpbmVUZXh0LCBjdXJzb3JQb3NpdGlvbiwgZG9jKSlcclxuICAgICAgcmV0dXJuOyBcclxuICAgIHJldHVybiB0aGlzLnNob3VsZENyZWF0ZUZvb3Rub3RlTWFya2VyKFxyXG4gICAgICBsaW5lVGV4dCxcclxuICAgICAgY3Vyc29yUG9zaXRpb24sXHJcbiAgICAgIGRvYyxcclxuICAgICAgbWFya2Rvd25UZXh0XHJcbiAgICApO1xyXG5cclxuXHJcbiAgfVxyXG4gIFxyXG4gIHByaXZhdGUgc2hvdWxkQ3JlYXRlTWF0Y2hpbmdGb290bm90ZURldGFpbChcclxuICAgIGxpbmVUZXh0OiBzdHJpbmcsXHJcbiAgICBjdXJzb3JQb3NpdGlvbjogRWRpdG9yUG9zaXRpb24sXHJcbiAgICBkb2M6IEVkaXRvclxyXG4gICkge1xyXG4gICAgLy8gQ3JlYXRlIG1hdGNoaW5nIGZvb3Rub3RlIGRldGFpbCBmb3IgZm9vdG5vdGUgbWFya2VyXHJcbiAgICBcclxuICAgIC8vIGRvZXMgdGhpcyBsaW5lIGhhdmUgYSBmb290bm90ZSBtYXJrZXI/XHJcbiAgICAvLyBkb2VzIHRoZSBjdXJzb3Igb3ZlcmxhcCB3aXRoIG9uZSBvZiB0aGVtP1xyXG4gICAgLy8gaWYgc28sIHdoaWNoIG9uZT9cclxuICAgIC8vIGRvZXMgdGhpcyBmb290bm90ZSBtYXJrZXIgaGF2ZSBhIGRldGFpbCBsaW5lP1xyXG4gICAgLy8gaWYgbm90LCBjcmVhdGUgaXQgYW5kIHBsYWNlIGN1cnNvciB0aGVyZVxyXG4gICAgbGV0IHJlT25seU1hcmtlcnNNYXRjaGVzID0gbGluZVRleHQubWF0Y2godGhpcy5OYW1lZFJlT25seU1hcmtlcnMpO1xyXG5cclxuICAgIGxldCBtYXJrZXJUYXJnZXQgPSBudWxsO1xyXG5cclxuICAgIGlmIChyZU9ubHlNYXJrZXJzTWF0Y2hlcyl7XHJcbiAgICAgIGZvciAobGV0IGkgPSAwOyBpIDw9IHJlT25seU1hcmtlcnNNYXRjaGVzLmxlbmd0aDsgaSsrKSB7XHJcbiAgICAgICAgbGV0IG1hcmtlciA9IHJlT25seU1hcmtlcnNNYXRjaGVzW2ldO1xyXG4gICAgICAgIGlmIChtYXJrZXIgIT0gdW5kZWZpbmVkKSB7XHJcbiAgICAgICAgICBsZXQgaW5kZXhPZk1hcmtlckluTGluZSA9IGxpbmVUZXh0LmluZGV4T2YobWFya2VyKTtcclxuICAgICAgICAgIGlmIChcclxuICAgICAgICAgICAgY3Vyc29yUG9zaXRpb24uY2ggPj0gaW5kZXhPZk1hcmtlckluTGluZSAmJlxyXG4gICAgICAgICAgICBjdXJzb3JQb3NpdGlvbi5jaCA8PSBpbmRleE9mTWFya2VySW5MaW5lICsgbWFya2VyLmxlbmd0aFxyXG4gICAgICAgICAgKSB7XHJcbiAgICAgICAgICAgIG1hcmtlclRhcmdldCA9IG1hcmtlcjtcclxuICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgaWYgKG1hcmtlclRhcmdldCAhPSBudWxsKSB7XHJcbiAgICAgIC8vZXh0cmFjdCBmb290bm90ZVxyXG4gICAgICBsZXQgbWF0Y2ggPSBtYXJrZXJUYXJnZXQubWF0Y2godGhpcy5OYW1lZFJlKVxyXG4gICAgICAvL2ZpbmQgaWYgdGhpcyBmb290bm90ZSBleGlzdHMgYnkgbGlzdGluZyBleGlzdGluZyBmb290bm90ZSBkZXRhaWxzXHJcbiAgICAgIGlmIChtYXRjaCkge1xyXG4gICAgICAgIGxldCBmb290bm90ZUlkID0gbWF0Y2hbMF07XHJcbiAgICAgICAgXHJcbiAgICAgICAgbGV0IGxpc3Q6IHN0cmluZ1tdID0gdGhpcy5saXN0RXhpc3RpbmdGb290bm90ZURldGFpbHMoZG9jKTtcclxuICAgICAgICBcclxuICAgICAgICAvLyBDaGVjayBpZiB0aGUgbGlzdCBpcyBlbXB0eSBPUiBpZiB0aGUgbGlzdCBkb2Vzbid0IGluY2x1ZGUgY3VycmVudCBmb290bm90ZVxyXG4gICAgICAgIC8vIGlmIHNvLCBhZGQgZGV0YWlsIGZvciB0aGUgY3VycmVudCBmb290bm90ZVxyXG4gICAgICAgIGlmKGxpc3QgPT09IG51bGwgfHwgIWxpc3QuaW5jbHVkZXMoZm9vdG5vdGVJZCkpIHtcclxuICAgICAgICAgIGxldCBsYXN0TGluZUluZGV4ID0gZG9jLmxhc3RMaW5lKCk7XHJcbiAgICAgICAgICBsZXQgbGFzdExpbmUgPSBkb2MuZ2V0TGluZShsYXN0TGluZUluZGV4KTtcclxuXHJcbiAgICAgICAgICB3aGlsZSAobGFzdExpbmVJbmRleCA+IDApIHtcclxuICAgICAgICAgICAgbGFzdExpbmUgPSBkb2MuZ2V0TGluZShsYXN0TGluZUluZGV4KTtcclxuICAgICAgICAgICAgaWYgKGxhc3RMaW5lLmxlbmd0aCA+IDApIHtcclxuICAgICAgICAgICAgICBkb2MucmVwbGFjZVJhbmdlKFxyXG4gICAgICAgICAgICAgICAgXCJcIixcclxuICAgICAgICAgICAgICAgIHsgbGluZTogbGFzdExpbmVJbmRleCwgY2g6IDAgfSxcclxuICAgICAgICAgICAgICAgIHsgbGluZTogZG9jLmxhc3RMaW5lKCksIGNoOiAwIH1cclxuICAgICAgICAgICAgICApO1xyXG4gICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGxhc3RMaW5lSW5kZXgtLTtcclxuICAgICAgICAgIH1cclxuICAgICAgICAgIFxyXG4gICAgICAgICAgbGV0IGZvb3Rub3RlRGV0YWlsID0gYFxcblteJHtmb290bm90ZUlkfV06IGA7XHJcbiAgICAgICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICBpZiAobGlzdD09PW51bGwgfHwgbGlzdC5sZW5ndGggPCAxKSB7XHJcbiAgICAgICAgICAgIGZvb3Rub3RlRGV0YWlsID0gXCJcXG5cIiArIGZvb3Rub3RlRGV0YWlsO1xyXG4gICAgICAgICAgICBkb2Muc2V0TGluZShkb2MubGFzdExpbmUoKSwgbGFzdExpbmUgKyBmb290bm90ZURldGFpbCk7XHJcbiAgICAgICAgICAgIGRvYy5zZXRDdXJzb3IoZG9jLmxhc3RMaW5lKCkgLSAxLCBmb290bm90ZURldGFpbC5sZW5ndGggLSAxKTtcclxuICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIGRvYy5zZXRMaW5lKGRvYy5sYXN0TGluZSgpLCBsYXN0TGluZSArIGZvb3Rub3RlRGV0YWlsKTtcclxuICAgICAgICAgICAgZG9jLnNldEN1cnNvcihkb2MubGFzdExpbmUoKSwgZm9vdG5vdGVEZXRhaWwubGVuZ3RoIC0gMSk7XHJcbiAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgcmV0dXJuIHRydWU7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJldHVybjsgXHJcbiAgICAgIH1cclxuICAgIH1cclxuICB9XHJcblxyXG4gIHByaXZhdGUgc2hvdWxkQ3JlYXRlRm9vdG5vdGVNYXJrZXIoXHJcbiAgICBsaW5lVGV4dDogc3RyaW5nLFxyXG4gICAgY3Vyc29yUG9zaXRpb246IEVkaXRvclBvc2l0aW9uLFxyXG4gICAgZG9jOiBFZGl0b3IsXHJcbiAgICBtYXJrZG93blRleHQ6IHN0cmluZ1xyXG4gICkge1xyXG4gICAgLy9jcmVhdGUgZW1wdHkgZm9vdG5vdGUgbWFya2VyIGZvciBuYW1lIGlucHV0XHJcbiAgICBsZXQgZW1wdHlNYXJrZXIgPSBgW15dYDtcclxuICAgIGRvYy5yZXBsYWNlUmFuZ2UoZW1wdHlNYXJrZXIsZG9jLmdldEN1cnNvcigpKTtcclxuICAgIC8vbW92ZSBjdXJzb3IgaW4gYmV0d2VlbiBbXiBhbmQgXVxyXG4gICAgZG9jLnNldEN1cnNvcihjdXJzb3JQb3NpdGlvbi5saW5lLCBjdXJzb3JQb3NpdGlvbi5jaCsyKTtcclxuICAgIC8vb3BlbiBmb290bm90ZVBpY2tlciBwb3B1cFxyXG4gICAgXHJcbiAgfVxyXG59XHJcblxyXG5cclxuLy9mb290bm90ZVBpY2tlciBwb3B1cCBjb3BpZWQgaW4gZnJvbSBodHRwczovL2dpdGh1Yi5jb20vU2lsZW50Vm9pZDEzL1RlbXBsYXRlclxyXG4vKlxyXG5leHBvcnQgY2xhc3MgZm9vdG5vdGVQaWNrZXIgZXh0ZW5kcyBFZGl0b3JTdWdnZXN0PFRwU3VnZ2VzdERvY3VtZW50YXRpb24+IHtcclxuICBwcml2YXRlIHRwX2tleXdvcmRfcmVnZXggPVxyXG4gIC90cFxcLig/PG1vZHVsZT5bYS16XSopPyg/PGZuX3RyaWdnZXI+XFwuKD88Zm4+W2Etel9dKik/KT8kLztcclxuICBwcml2YXRlIGRvY3VtZW50YXRpb246IERvY3VtZW50YXRpb247XHJcbiAgcHJpdmF0ZSBsYXRlc3RfdHJpZ2dlcl9pbmZvOiBFZGl0b3JTdWdnZXN0VHJpZ2dlckluZm87XHJcbiAgcHJpdmF0ZSBtb2R1bGVfbmFtZTogTW9kdWxlTmFtZSB8IHN0cmluZztcclxuICBwcml2YXRlIGZ1bmN0aW9uX3RyaWdnZXI6IGJvb2xlYW47XHJcbiAgcHJpdmF0ZSBmdW5jdGlvbl9uYW1lOiBzdHJpbmc7XHJcblxyXG4gIGNvbnN0cnVjdG9yKCkge1xyXG4gICAgc3VwZXIoYXBwKTtcclxuICAgIHRoaXMuZG9jdW1lbnRhdGlvbiA9IG5ldyBEb2N1bWVudGF0aW9uKCk7XHJcbiAgfVxyXG5cclxuICBvblRyaWdnZXIoXHJcbiAgICAgIGN1cnNvcjogRWRpdG9yUG9zaXRpb24sXHJcbiAgICAgIGVkaXRvcjogRWRpdG9yLFxyXG4gICAgICBfZmlsZTogVEZpbGVcclxuICApOiBFZGl0b3JTdWdnZXN0VHJpZ2dlckluZm8gfCBudWxsIHtcclxuICAgICAgY29uc3QgcmFuZ2UgPSBlZGl0b3IuZ2V0UmFuZ2UoXHJcbiAgICAgICAgICB7IGxpbmU6IGN1cnNvci5saW5lLCBjaDogMCB9LFxyXG4gICAgICAgICAgeyBsaW5lOiBjdXJzb3IubGluZSwgY2g6IGN1cnNvci5jaCB9XHJcbiAgICAgICk7XHJcbiAgICAgIGNvbnN0IG1hdGNoID0gdGhpcy50cF9rZXl3b3JkX3JlZ2V4LmV4ZWMocmFuZ2UpO1xyXG4gICAgICBpZiAoIW1hdGNoKSB7XHJcbiAgICAgICAgICByZXR1cm4gbnVsbDtcclxuICAgICAgfVxyXG5cclxuICAgICAgbGV0IHF1ZXJ5OiBzdHJpbmc7XHJcbiAgICAgIGNvbnN0IG1vZHVsZV9uYW1lID0gKG1hdGNoLmdyb3VwcyAmJiBtYXRjaC5ncm91cHNbXCJtb2R1bGVcIl0pIHx8IFwiXCI7XHJcbiAgICAgIHRoaXMubW9kdWxlX25hbWUgPSBtb2R1bGVfbmFtZTtcclxuXHJcbiAgICAgIGlmIChtYXRjaC5ncm91cHMgJiYgbWF0Y2guZ3JvdXBzW1wiZm5fdHJpZ2dlclwiXSkge1xyXG4gICAgICAgICAgaWYgKG1vZHVsZV9uYW1lID09IFwiXCIgfHwgIWlzX21vZHVsZV9uYW1lKG1vZHVsZV9uYW1lKSkge1xyXG4gICAgICAgICAgICAgIHJldHVybiBudWxsO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgICAgdGhpcy5mdW5jdGlvbl90cmlnZ2VyID0gdHJ1ZTtcclxuICAgICAgICAgIHRoaXMuZnVuY3Rpb25fbmFtZSA9IG1hdGNoLmdyb3Vwc1tcImZuXCJdIHx8IFwiXCI7XHJcbiAgICAgICAgICBxdWVyeSA9IHRoaXMuZnVuY3Rpb25fbmFtZTtcclxuICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgIHRoaXMuZnVuY3Rpb25fdHJpZ2dlciA9IGZhbHNlO1xyXG4gICAgICAgICAgcXVlcnkgPSB0aGlzLm1vZHVsZV9uYW1lO1xyXG4gICAgICB9XHJcblxyXG4gICAgICBjb25zdCB0cmlnZ2VyX2luZm86IEVkaXRvclN1Z2dlc3RUcmlnZ2VySW5mbyA9IHtcclxuICAgICAgICAgIHN0YXJ0OiB7IGxpbmU6IGN1cnNvci5saW5lLCBjaDogY3Vyc29yLmNoIC0gcXVlcnkubGVuZ3RoIH0sXHJcbiAgICAgICAgICBlbmQ6IHsgbGluZTogY3Vyc29yLmxpbmUsIGNoOiBjdXJzb3IuY2ggfSxcclxuICAgICAgICAgIHF1ZXJ5OiBxdWVyeSxcclxuICAgICAgfTtcclxuICAgICAgdGhpcy5sYXRlc3RfdHJpZ2dlcl9pbmZvID0gdHJpZ2dlcl9pbmZvO1xyXG4gICAgICByZXR1cm4gdHJpZ2dlcl9pbmZvO1xyXG4gIH1cclxuXHJcbiAgZ2V0U3VnZ2VzdGlvbnMoY29udGV4dDogRWRpdG9yU3VnZ2VzdENvbnRleHQpOiBUcFN1Z2dlc3REb2N1bWVudGF0aW9uW10ge1xyXG4gICAgICBsZXQgc3VnZ2VzdGlvbnM6IEFycmF5PFRwU3VnZ2VzdERvY3VtZW50YXRpb24+O1xyXG4gICAgICBpZiAodGhpcy5tb2R1bGVfbmFtZSAmJiB0aGlzLmZ1bmN0aW9uX3RyaWdnZXIpIHtcclxuICAgICAgICAgIHN1Z2dlc3Rpb25zID0gdGhpcy5kb2N1bWVudGF0aW9uLmdldF9hbGxfZnVuY3Rpb25zX2RvY3VtZW50YXRpb24oXHJcbiAgICAgICAgICAgICAgdGhpcy5tb2R1bGVfbmFtZSBhcyBNb2R1bGVOYW1lXHJcbiAgICAgICAgICApIGFzIFRwRnVuY3Rpb25Eb2N1bWVudGF0aW9uW107XHJcbiAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICBzdWdnZXN0aW9ucyA9IHRoaXMuZG9jdW1lbnRhdGlvbi5nZXRfYWxsX21vZHVsZXNfZG9jdW1lbnRhdGlvbigpO1xyXG4gICAgICB9XHJcbiAgICAgIGlmICghc3VnZ2VzdGlvbnMpIHtcclxuICAgICAgICAgIHJldHVybiBbXTtcclxuICAgICAgfVxyXG4gICAgICByZXR1cm4gc3VnZ2VzdGlvbnMuZmlsdGVyKChzKSA9PiBzLm5hbWUuc3RhcnRzV2l0aChjb250ZXh0LnF1ZXJ5KSk7XHJcbiAgfVxyXG5cclxuICByZW5kZXJTdWdnZXN0aW9uKHZhbHVlOiBUcFN1Z2dlc3REb2N1bWVudGF0aW9uLCBlbDogSFRNTEVsZW1lbnQpOiB2b2lkIHtcclxuICAgICAgZWwuY3JlYXRlRWwoXCJiXCIsIHsgdGV4dDogdmFsdWUubmFtZSB9KTtcclxuICAgICAgZWwuY3JlYXRlRWwoXCJiclwiKTtcclxuICAgICAgaWYgKHRoaXMuZnVuY3Rpb25fdHJpZ2dlciAmJiBpc19mdW5jdGlvbl9kb2N1bWVudGF0aW9uKHZhbHVlKSkge1xyXG4gICAgICAgICAgZWwuY3JlYXRlRWwoXCJjb2RlXCIsIHsgdGV4dDogdmFsdWUuZGVmaW5pdGlvbiB9KTtcclxuICAgICAgfVxyXG4gICAgICBpZiAodmFsdWUuZGVzY3JpcHRpb24pIHtcclxuICAgICAgICAgIGVsLmNyZWF0ZUVsKFwiZGl2XCIsIHsgdGV4dDogdmFsdWUuZGVzY3JpcHRpb24gfSk7XHJcbiAgICAgIH1cclxuICB9XHJcblxyXG4gIHNlbGVjdFN1Z2dlc3Rpb24oXHJcbiAgICAgIHZhbHVlOiBUcFN1Z2dlc3REb2N1bWVudGF0aW9uLFxyXG4gICAgICBfZXZ0OiBNb3VzZUV2ZW50IHwgS2V5Ym9hcmRFdmVudFxyXG4gICk6IHZvaWQge1xyXG4gICAgICBjb25zdCBhY3RpdmVfdmlldyA9IGFwcC53b3Jrc3BhY2UuZ2V0QWN0aXZlVmlld09mVHlwZShNYXJrZG93blZpZXcpO1xyXG4gICAgICBpZiAoIWFjdGl2ZV92aWV3KSB7XHJcbiAgICAgICAgICAvLyBUT0RPOiBFcnJvciBtc2dcclxuICAgICAgICAgIHJldHVybjtcclxuICAgICAgfVxyXG4gICAgICBhY3RpdmVfdmlldy5lZGl0b3IucmVwbGFjZVJhbmdlKFxyXG4gICAgICAgICAgdmFsdWUubmFtZSxcclxuICAgICAgICAgIHRoaXMubGF0ZXN0X3RyaWdnZXJfaW5mby5zdGFydCxcclxuICAgICAgICAgIHRoaXMubGF0ZXN0X3RyaWdnZXJfaW5mby5lbmRcclxuICAgICAgKTtcclxuICAgICAgaWYgKFxyXG4gICAgICAgICAgdGhpcy5sYXRlc3RfdHJpZ2dlcl9pbmZvLnN0YXJ0LmNoID09IHRoaXMubGF0ZXN0X3RyaWdnZXJfaW5mby5lbmQuY2hcclxuICAgICAgKSB7XHJcbiAgICAgICAgICAvLyBEaXJ0eSBoYWNrIHRvIHByZXZlbnQgdGhlIGN1cnNvciBiZWluZyBhdCB0aGVcclxuICAgICAgICAgIC8vIGJlZ2lubmluZyBvZiB0aGUgd29yZCBhZnRlciBjb21wbGV0aW9uLFxyXG4gICAgICAgICAgLy8gTm90IHN1cmUgd2hhdCdzIHRoZSBjYXVzZSBvZiB0aGlzIGJ1Zy5cclxuICAgICAgICAgIGNvbnN0IGN1cnNvcl9wb3MgPSB0aGlzLmxhdGVzdF90cmlnZ2VyX2luZm8uZW5kO1xyXG4gICAgICAgICAgY3Vyc29yX3Bvcy5jaCArPSB2YWx1ZS5uYW1lLmxlbmd0aDtcclxuICAgICAgICAgIGFjdGl2ZV92aWV3LmVkaXRvci5zZXRDdXJzb3IoY3Vyc29yX3Bvcyk7XHJcbiAgICAgIH1cclxuICB9XHJcbn1cclxuKi8i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
