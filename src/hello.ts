import {Index} from "flexsearch";
import * as fs from 'fs';
import kuromoji, {IpadicFeatures, Tokenizer} from 'kuromoji';
import * as path from 'path';
import {toHiragana} from '@koozaki/romaji-conv';

type Library = {
    libid: string
    formal: string
    systemid: string
    systemname: string
}

function normalizeName(s: string): string {
    // 記号などの処理
    return s.replace(/[「」・（）]/g, ' ');
}

function stripBanalWord(s: string): string {
    // ありふれたキーワードを除外する
    return s.replace(/立図書館$|図書館$|図書室$/g, '');
}

function splitMorphologicalWithReading(s: string, tokenizer: Tokenizer<IpadicFeatures>): string[] {
    let clean: string = normalizeName(s);
    const parsed = tokenizer.tokenize(clean);
    let yomi: string[] = [];
    let x: string[] = [stripBanalWord(clean)];
    parsed.forEach(element => {
        yomi.push(element.reading ? element.reading : element.surface_form);
        x.push(element.surface_form);
    });
    return x.concat([toHiragana(yomi.join(''))])
}

function splitMorphological(s: string, tokenizer: Tokenizer<IpadicFeatures>): string[] {
    let clean: string = normalizeName(s);
    const parsed = tokenizer.tokenize(clean);
    let x: string[] = [stripBanalWord(clean)];
    parsed.forEach(element => {
        x.push(element.surface_form);
    });
    console.log(x)
    return x
}

function add_index(index: Index, tokenizer: Tokenizer<IpadicFeatures>): void {
    const libdata = JSON.parse(fs.readFileSync('./src/library.json', 'utf8')) as Library[];
    libdata.forEach((item) => {
        // システム単位でインデックスされていない場合
        if (!index.contain(item.systemid)) {
            index.add(item.systemid, splitMorphologicalWithReading(item.systemname, tokenizer).join(' '));
        }
        // 図書館単位でのインデックス
        index.add(item.libid, splitMorphologicalWithReading(item.formal, tokenizer).join(' '));
    })
}


kuromoji.builder({
    dicPath: path.resolve(__dirname, '../node_modules/kuromoji/dict')
}).build(function (err, tokenizer) {

    // Flexsearch
    let start = process.hrtime()
    const index = new Index({
        preset: "performance",
        optimize: true,
        context: true,
        tokenize: 'full',
        filter: [
            "図書館", "図書", "室", "市", "市立", "町", "町立"
        ]
    });
    add_index(index, tokenizer);
    let end = process.hrtime(start)
    console.info('Index Execution time (hr): %ds %dms', end[0], end[1] / 1000000)

    console.log(index.search('中津川市'));
    end = process.hrtime(start)
    console.info('Search Execution time (hr): %ds %dms', end[0], end[1] / 1000000)
    index.export(
        (key, data) => fs.writeFileSync(`index/${key}.json`, data !== undefined ? data : '')
    )
});
