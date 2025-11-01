export class Point {
    private x: number;
    private y: number;
  
    constructor(x: number, y: number) {
      this.x = x;
      this.y = y;
    }
  
    public equals({ x, y }: Point): boolean {
      return this.x === x && this.y === y;
    }
  
    public calcDeltaXTo({ x }: Point): number {
      return this.x - x;
    }
  
    public calcDeltaYTo({ y }: Point): number {
      return this.y - y;
    }
  
    public calcHorizontalDistanceTo(point: Point): number {
      return Math.abs(this.calcDeltaXTo(point));
    }
  
    public calcVerticalDistance(point: Point): number {
      return Math.abs(this.calcDeltaYTo(point));
    }
  
    public calcDistanceTo(point: Point): number {
      return Math.sqrt(
        Math.pow(this.calcDeltaXTo(point), 2) + Math.pow(this.calcDeltaYTo(point), 2)
      );
    }
}
