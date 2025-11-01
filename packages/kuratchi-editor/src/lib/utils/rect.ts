import { Point } from './point';

type ContainsPointReturn = {
  result: boolean;
  reason: {
    isOnBottomSide: boolean;
    isOnLeftSide: boolean;
    isOnRightSide: boolean;
    isOnTopSide: boolean;
  };
};

export class Rect {
  private left: number;
  private right: number;
  private top: number;
  private bottom: number;

  constructor(left: number, top: number, right: number, bottom: number) {
    this.left = left;
    this.right = right;
    this.top = top;
    this.bottom = bottom;
  }

  public static fromDOM(dom: HTMLElement): Rect {
    const rect = dom.getBoundingClientRect();
    return new Rect(rect.left, rect.top, rect.right, rect.bottom);
  }

  public generateNewRect({
    left = this.left,
    top = this.top,
    right = this.right,
    bottom = this.bottom,
  }): Rect {
    return new Rect(left, top, right, bottom);
  }

  public contains(point: Point): ContainsPointReturn {
    const pointX = point['x'];
    const pointY = point['y'];
    const isOnLeftSide = pointX < this.left;
    const isOnRightSide = pointX > this.right;
    const isOnTopSide = pointY < this.top;
    const isOnBottomSide = pointY > this.bottom;

    const result =
      !isOnLeftSide && !isOnRightSide && !isOnTopSide && !isOnBottomSide;

    return {
      reason: {
        isOnBottomSide,
        isOnLeftSide,
        isOnRightSide,
        isOnTopSide,
      },
      result,
    };
  }
}
