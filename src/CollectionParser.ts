import ICollectionProperty from './ICollectionProperty';

const jsdom = require('jsdom');

const { JSDOM } = jsdom;

export default class CollectionParser {
  private constructor(private readonly dom: typeof JSDOM) {}

  static async fromFile(filePath: string): Promise<CollectionParser> {
    const dom = await JSDOM.fromFile(filePath);

    return new CollectionParser(dom);
  }

  parseCollection(): ICollectionProperty[] {
    const { dom } = this;

    const document = dom.window.document as Document;

    const elements = document.getElementsByClassName('item--property');

    const properties = Array.from(elements).map((property) => {
      const getElements = property.getElementsByClassName.bind(property);
      const getElement = (cn: string) => getElements(cn)[0];

      const typeElem = getElement('Property--type');
      const valueElem = getElement('Property--value');
      const rarityElem = getElement('Property--rarity');

      const rarityString = rarityElem.textContent || '';

      const type = typeElem.textContent || '';
      const value = valueElem.textContent || '';
      const rarity = parseFloat(
        rarityString.slice(0, rarityString.indexOf('%')),
      );

      return { type, value, rarity } as ICollectionProperty;
    });

    const avgPriceElem = document.getElementsByClassName(
      'PriceHistoryStats--value',
    )[0] || { textContent: '..0,0' };
    const avgPriceString = avgPriceElem.textContent as string;
    const avgPrice = avgPriceString.slice(2).replace(',', '.');

    return [...properties, { type: 'Price', value: avgPrice, rarity: 1 }];
  }
}
