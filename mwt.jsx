class RandomEngine {
    constructor() {
        this.size = 1024;
        this.array = new Uint32Array(this.size);
        this.offset = 0;
        self.crypto.getRandomValues(this.array);
    }

    next() {
        if (this.offset === this.size) {
            self.crypto.getRandomValues(this.array);
            this.offset = 0;
        }
        return this.array[this.offset++];
    }
}

function indexFromParameters(index1, index2, orderInsensitive = false) {
    if (orderInsensitive) {
        if (index1 > index2) {
            [index1, index2] = [index2, index1];
        }
    }
    return (index1 + index2) * (index1 + index2 + 1) / 2 + index1;
}

function generatePoints(randomEngine, pointNumber) {
    const resolution = 1024;
    const grid = 16;
    const padding = 4;

    const points = [];

    const center = { x: resolution / 2, y: resolution / 2 };
    const radius2 = Math.pow(Math.min(resolution / 2, resolution / 2), 2);

    const pointList = new Set();
    while (points.length < pointNumber) {
        let x = randomEngine.next() % resolution;
        let y = randomEngine.next() % resolution;

        if ((x - center.x) * (x - center.x) + (y - center.y) * (y - center.y) > radius2) {
            continue;
        }

        const pointIndex = indexFromParameters(Math.floor(x / grid), Math.floor(y / grid));
        if (pointList.has(pointIndex)) {
            continue;
        }

        if (x % grid < padding) {
            x += padding;
        } else if (x % grid >= grid - padding) {
            x -= padding;
        }

        if (y % grid < padding) {
            y += padding;
        } else if (y % grid >= grid - padding) {
            y -= padding;
        }

        points.push({ x: x / resolution, y: y / resolution });
        pointList.add(pointIndex);
    }

    return points;
}

function distance(p1, p2) {
    return Math.sqrt((p1.x - p2.x) * (p1.x - p2.x) + (p1.y - p2.y) * (p1.y - p2.y));
}

function aligned(p1, p2, p3) {
    return Math.sign((p2.x - p1.x) * (p3.x - p1.x) + (p2.y - p1.y) * (p3.y - p1.y));
}

function anticlockwise(p1, p2, p3) {
    return Math.sign((p2.x - p1.x) * (p3.y - p1.y) - (p3.x - p1.x) * (p2.y - p1.y));
}

function convexHull(points) {
    for (let i = 0; i < points.length; i++) {
        if (anticlockwise(points[i], points[(i + 1) % points.length], points[(i + 2) % points.length]) !== 1) {
            return false;
        }
    }

    return true;
}

class PointBand {
    static DatumPoints = [
        { x: 0.0, y: 1.0 },
        { x: -Math.sin(Math.PI * 2 / 3), y: -0.5 },
        { x: Math.sin(Math.PI * 2 / 3), y: -0.5 }
    ];

    constructor(originPoint) {
        this.originPoint = originPoint;

        this.points = [];
        this.circularLinkList = [];
        this.reversedCircularLinkList = [];

        this.setupDatumPoint();
    }

    aligned(nodeIndex1, nodeIndex2) {
        return aligned(this.originPoint, this.points[nodeIndex1], this.points[nodeIndex2]);
    }

    anticlockwise(nodeIndex1, nodeIndex2) {
        return anticlockwise(this.originPoint, this.points[nodeIndex1], this.points[nodeIndex2]);
    }

    setupDatumPoint() {
        for (let i = 1; i <= PointBand.DatumPoints.length; i++) {
            this.points[-i] = { x: this.originPoint.x + PointBand.DatumPoints[i - 1].x, y: this.originPoint.y + PointBand.DatumPoints[i - 1].y };
            this.circularLinkList[-i] = (-i) % 3 - 1;
            this.reversedCircularLinkList[(-i) % 3 - 1] = -i;
        }
    }

    addNode(nodeIndex, point) {
        if (this.circularLinkList[nodeIndex] !== undefined) {
            throw "Invalid parameter.";
        }

        this.points[nodeIndex] = point;

        for (let i = 1; i <= 3; i++) {
            if (this.anticlockwise(-i, nodeIndex) >= 0 && this.anticlockwise(nodeIndex, (-i) % 3 - 1) > 0) {
                let j = -i;
                while (j !== (-i) % 3 - 1) {
                    const nextNodeIndex = this.circularLinkList[j];

                    if (this.anticlockwise(j, nodeIndex) >= 0 && this.anticlockwise(nodeIndex, nextNodeIndex) > 0) {
                        this.circularLinkList[nodeIndex] = nextNodeIndex;
                        this.circularLinkList[j] = nodeIndex;
                        this.reversedCircularLinkList[nodeIndex] = j;
                        this.reversedCircularLinkList[nextNodeIndex] = nodeIndex;
                        break;
                    }

                    j = this.circularLinkList[j]
                }

                if (j !== (-i) % 3 - 1) {
                    return;
                }
            }

        }

        throw "Unexpected.";
    }

    deleteNode(nodeIndex) {
        if (this.circularLinkList[nodeIndex] === undefined) {
            throw "Invalid parameter.";
        }

        const nextNodeIndex = this.circularLinkList[nodeIndex];
        const preNodeIndex = this.reversedCircularLinkList[nodeIndex];
        this.circularLinkList[preNodeIndex] = nextNodeIndex;
        this.reversedCircularLinkList[nextNodeIndex] = preNodeIndex;

        delete this.reversedCircularLinkList[nodeIndex];
        delete this.circularLinkList[nodeIndex];
        delete this.points[nodeIndex];
    }

    getAheadNodes(startNodeIndex, count) {
        if (this.circularLinkList[startNodeIndex] === undefined) {
            throw "Invalid parameter.";
        }

        const pointList = [];

        let nodeIndex = this.circularLinkList[startNodeIndex];
        while (pointList.length < count && nodeIndex !== startNodeIndex) {
            if (nodeIndex >= 0) {
                pointList.push(nodeIndex);
            }
            nodeIndex = this.circularLinkList[nodeIndex];
        }

        return pointList;
    }
}

class Network {
    constructor(points, randomEngine) {
        this._randomEngine = randomEngine;
        this._points = points;
        this._segments = [];
        this._boundingSegmentList = new Set();
        this._internalSegmentList = new Set();
        this._adjacencyList = this._points.map((point, i) => new PointBand(point, i));
    }

    distance(index1, index2) {
        return distance(this._points[index1], this._points[index2]);
    }

    aligned(index1, index2, index3) {
        return aligned(this._points[index1], this._points[index2], this._points[index3]);
    }

    anticlockwise(index1, index2, index3) {
        return anticlockwise(this._points[index1], this._points[index2], this._points[index3]);
    }

    convexHull(indexes) {
        return convexHull(indexes.map(i => this._points[i]));
    }

    totalLength(segmentList) {
        return segmentList.reduce((length, index) => length + this.distance(...this._segments[index]), 0.0);
    }

    segmentIndex(index1, index2) {
        return indexFromParameters(index1, index2, true);
    }

    addSegment(pointIndex1, pointIndex2, bounding = false) {
        const segmentIndex = this.segmentIndex(pointIndex1, pointIndex2);
        this._segments[segmentIndex] = [pointIndex1, pointIndex2];
        if (bounding) {
            this._boundingSegmentList.add(segmentIndex);
        } else {
            this._internalSegmentList.add(segmentIndex);
        }
        this._adjacencyList[pointIndex1].addNode(pointIndex2, this._points[pointIndex2]);
        this._adjacencyList[pointIndex2].addNode(pointIndex1, this._points[pointIndex1]);
    }

    deleteSegment(pointIndex1, pointIndex2) {
        const segmentIndex = this.segmentIndex(pointIndex1, pointIndex2);
        this._adjacencyList[pointIndex1].deleteNode(pointIndex2);
        this._adjacencyList[pointIndex2].deleteNode(pointIndex1);
        this._internalSegmentList.delete(segmentIndex);
    }

    normalizeTriangle(trianglePointList) {
        if (this.anticlockwise(...trianglePointList) !== 1) {
            [trianglePointList[1], trianglePointList[2]] = [trianglePointList[2], trianglePointList[1]];
        }
        return trianglePointList;
    }

    tangentRange(pointList, sourcePointIndex, scope) {
        if (!scope) {
            scope = [0, pointList.length];
        }
        let range = [scope[0], scope[0]];
        for (let i = scope[0]; i < (scope[0] > scope[1] ? scope[1] + pointList.length : scope[1]); i++) {
            const direction = this.anticlockwise(pointList[i % pointList.length], pointList[(i + 1) % pointList.length], sourcePointIndex);
            if (direction === -1 || direction === 0 && this.aligned(sourcePointIndex, pointList[i % pointList.length], pointList[(i + 1) % pointList.length]) < 0) {
                if (range[0] === range[1]) {
                    range = [i, i + 1];
                } else if (range[1] === i) {
                    range[1] = i + 1;
                } else if (range[0] === scope[0]) {
                    range[0] = i;
                    range[1] = range[1] + pointList.length;
                }
            }
        }

        return [range[0] % pointList.length, range[1] % pointList.length];
    }

    findOuterConvexHull(pointList) {
        const bounding = pointList.length === this._points.length;

        if (pointList.length === 1) {
            return [pointList, []];
        }

        let j = 2;
        while (j < pointList.length && this.anticlockwise(pointList[0], pointList[1], pointList[j]) === 0) {
            j++;
        }

        if (j === pointList.length) { //All points in same line
            if (this._points[pointList[0]].x === this._points[pointList[1]].x) {
                pointList.sort((a, b) => this._points[a].y - this._points[b].y);
            } else {
                pointList.sort((a, b) => this._points[a].x - this._points[b].x);
            }
            for (let i = 0; i < pointList.length - 1; i++) {
                this.addSegment(pointList[i], pointList[i + 1]);
            }
            const boundingConvexHullPointList = [...pointList];
            for (let i = pointList.length - 2; i > 0; i--) {
                boundingConvexHullPointList.push(pointList[i]);
            }
            return [boundingConvexHullPointList, []];
        } else {
            const availablePointList = new Set(pointList);
            const initialPointList = [...pointList.splice(j, 1), ...pointList.splice(0, 2)];

            const boundingConvexHullPointList = this.normalizeTriangle(initialPointList);
            while (pointList.length !== 0) {
                const pointIndex = pointList.shift();
                const range = this.tangentRange(boundingConvexHullPointList, pointIndex);
                if (range[0] < range[1]) {
                    boundingConvexHullPointList.splice(range[0] + 1, range[1] - range[0] - 1, pointIndex);
                } else if (range[0] > range[1]) {
                    boundingConvexHullPointList.splice(range[0] + 1);
                    boundingConvexHullPointList.splice(0, range[1], pointIndex);
                }
            }

            for (let i = 0; i < boundingConvexHullPointList.length; i++) {
                this.addSegment(boundingConvexHullPointList[i], boundingConvexHullPointList[(i + 1) % boundingConvexHullPointList.length], bounding);
                availablePointList.delete(boundingConvexHullPointList[i]);
            }
            return [boundingConvexHullPointList, Array.from(availablePointList)];
        }
    }

    connectInsideConvexHull(pointList) {
        if (pointList.length <= 3) {
            return;
        }

        for (let i = 0; i < pointList.length - 2; i++) {
            for (let j = 0; j < pointList.length - 3; j++) {
                let k = (j + i + 2) % pointList.length;
                if (i < k) {
                    if (pointList.every(u => u === pointList[i] || u === pointList[k] || this.anticlockwise(pointList[i], pointList[k], u) !== 0)) {
                        //found (i, k)

                        this.addSegment(pointList[i], pointList[k]);
                        this.connectInsideConvexHull(pointList.slice(i, k + 1));
                        this.connectInsideConvexHull([...pointList.slice(k), ...pointList.slice(0, i + 1)]);
                        return;
                    }
                }
            }
        }
    }

    connectBetweenConvexHulls(outerPointList, innerPointList) {
        if (innerPointList.length === 1) {
            for (const pointIndex of outerPointList) {
                this.addSegment(pointIndex, innerPointList[0]);
            }
        } else {
            let i = 0;
            while (i < outerPointList.length && this.anticlockwise(innerPointList[0], innerPointList[1], outerPointList[i]) !== -1) {
                i++;
            }

            if (i === outerPointList.length) {
                throw "Unexpected.";
            }

            const range = this.tangentRange(innerPointList, outerPointList[i]);
            if (range[0] < range[1]) {
                for (let j = range[0]; j <= range[1]; j++) {
                    this.addSegment(outerPointList[i], innerPointList[j]);
                }
            } else if (range[0] > range[1]) {
                for (let j = range[0]; j <= range[1] + innerPointList.length; j++) {
                    this.addSegment(outerPointList[i], innerPointList[j % innerPointList.length]);
                }
            } else {
                throw "Unexpected.";
            }

            const scope = [range[1], range[0]];
            for (let k = 0; k < outerPointList.length - 1; k++) {
                i = (i + 1) % outerPointList.length;
                const range = this.tangentRange(innerPointList, outerPointList[i], scope);
                if (range[0] === range[1]) {
                    this.addSegment(outerPointList[i], innerPointList[scope[0]]);
                } else {
                    if (range[0] < range[1]) {
                        for (let j = range[0]; j <= range[1]; j++) {
                            this.addSegment(outerPointList[i], innerPointList[j]);
                        }
                    } else {
                        for (let j = range[0]; j <= range[1] + innerPointList.length; j++) {
                            this.addSegment(outerPointList[i], innerPointList[j % innerPointList.length]);
                        }
                    }
                    scope[0] = range[1];
                }
            }
        }
    }

    buildConnectionSchemeInternal(pointList) {
        const [convexHullPointList, restPointList] = this.findOuterConvexHull(pointList);
        if (restPointList.length === 0) {
            this.connectInsideConvexHull(convexHullPointList);
        } else {
            const innerConvexHullPointList = this.buildConnectionSchemeInternal(restPointList);
            this.connectBetweenConvexHulls(convexHullPointList, innerConvexHullPointList);
        }

        return convexHullPointList;
    }

    buildConnectionScheme() {
        this.buildConnectionSchemeInternal([...this._points.keys()]);
        const internalSegmentList = [...this._internalSegmentList];
        const internalSegmentTotalLength = this.totalLength(internalSegmentList);
        return [
            [...this._boundingSegmentList],
            internalSegmentList,
            internalSegmentTotalLength
        ];
    }

    selectConvexHulls(segment, sides) {
        const convexHulls = [];
        for (const side of sides) {
            if (side === 4) {

                const clockwisePointList0 = this._adjacencyList[segment[0]].getAheadNodes(segment[1], 1);
                const clockwisePointList1 = this._adjacencyList[segment[1]].getAheadNodes(segment[0], 1);

                const pointList = [segment[0], clockwisePointList1[0], segment[1], clockwisePointList0[0]];

                if (this.convexHull(pointList)) {
                    convexHulls.push({
                        pointList,
                        segmentList: [[0, 2]]
                    });
                }
            } else if (side === 5) {
                const clockwisePointList0 = this._adjacencyList[segment[0]].getAheadNodes(segment[1], 2);
                const clockwisePointList1 = this._adjacencyList[segment[1]].getAheadNodes(segment[0], 2);

                if (clockwisePointList0.length > 1) {
                    const pointList = [segment[0], clockwisePointList1[0], segment[1], clockwisePointList0[0], clockwisePointList0[1]];

                    if (this.convexHull(pointList)) {
                        convexHulls.push({
                            pointList,
                            segmentList: [[0, 2], [0, 3]]
                        });
                    }
                }
                if (clockwisePointList1.length > 1) {
                    const pointList = [segment[0], clockwisePointList1[0], clockwisePointList1[1], segment[1], clockwisePointList0[0]];

                    if (this.convexHull(pointList)) {
                        convexHulls.push({
                            pointList,
                            segmentList: [[3, 0], [3, 1]]
                        });
                    }
                }

            }
        }
        return convexHulls;
    }

    fineTuneConvexHull(convexHull, replacementLog, influencedSegmentAddList, influencedSegmentDeleteList) {
        const pointList = convexHull.pointList;
        const segmentList = convexHull.segmentList;

        if (pointList.length === 4) {
            const segmentIndex = segmentList[0];
            const segment1 = [pointList[segmentIndex[0]], pointList[segmentIndex[1]]];
            const segment2 = [pointList[(segmentIndex[0] + 1) % pointList.length], pointList[(segmentIndex[1] + 1) % pointList.length]];
            const distance1 = this.distance(...segment1);
            const distance2 = this.distance(...segment2);

            if (distance1 > distance2) {
                this.deleteSegment(...segment1);
                this.addSegment(...segment2);
                replacementLog.push([segment1, segment2, distance2 - distance1]);

                influencedSegmentAddList.push(...[
                    [pointList[0], pointList[1]],
                    [pointList[1], pointList[2]],
                    [pointList[2], pointList[3]],
                    [pointList[3], pointList[0]]
                ].map(segment => this.segmentIndex(...segment)));

                return true;
            }
        } else if (pointList.length === 5) {
            const originalSegmentList = segmentList.map(i => i.map(j => pointList[j]));
            let originalDistances = originalSegmentList.map(i => this.distance(...i));

            let optimalOffset = 0;
            let optimalSegmentList;
            let optimalDistances = [...originalDistances];

            for (let offset of [-1, 1]) {
                const adjustiveSegmentList = segmentList.map(i => [...i.map(j => pointList[(j + pointList.length + offset) % pointList.length])]);
                const adjustiveDistances = adjustiveSegmentList.map(i => this.distance(...i));
                if (adjustiveDistances[0] + adjustiveDistances[1] < optimalDistances[0] + optimalDistances[1]) {
                    optimalOffset = offset;
                    optimalSegmentList = adjustiveSegmentList;
                    optimalDistances = adjustiveDistances;
                }
            }

            if (optimalOffset !== 0) {
                const order = optimalOffset - 1 ? [1, 0] : [0, 1];

                this.deleteSegment(...originalSegmentList[order[0]]);
                this.addSegment(...optimalSegmentList[order[0]]);
                this.deleteSegment(...originalSegmentList[order[1]]);
                this.addSegment(...optimalSegmentList[order[1]]);

                replacementLog.push(
                    [originalSegmentList[order[0]], optimalSegmentList[order[0]], optimalDistances[order[0]] - originalDistances[order[0]]],
                    [originalSegmentList[order[1]], optimalSegmentList[order[1]], optimalDistances[order[1]] - originalDistances[order[1]]]
                );
                influencedSegmentDeleteList.push(this.segmentIndex(...originalSegmentList[1]));
                influencedSegmentAddList.push(...[
                    [pointList[0], pointList[1]],
                    [pointList[1], pointList[2]],
                    [pointList[2], pointList[3]],
                    [pointList[3], pointList[4]],
                    [pointList[4], pointList[0]],
                    optimalSegmentList[0],
                    optimalSegmentList[1]
                ].map(segment => this.segmentIndex(...segment)));

                return true;
            }
        }
    }

    shuffleConvexHull(convexHull, replacementLog, influencedSegmentAddList) {
        const pointList = convexHull.pointList;
        if (pointList.length === 4) {
            const segmentIndex = convexHull.segmentList[0];
            const segment1 = [pointList[segmentIndex[0]], pointList[segmentIndex[1]]];
            const segment2 = [pointList[(segmentIndex[0] + 1) % pointList.length], pointList[(segmentIndex[1] + 1) % pointList.length]];

            const distance1 = this.distance(...segment1);
            const distance2 = this.distance(...segment2);

            this.deleteSegment(...segment1);
            this.addSegment(...segment2);
            replacementLog.push([segment1, segment2, distance2 - distance1]);
            influencedSegmentAddList.push(this.segmentIndex(...segment2));
        }
    }

    fineTuneForConvexQuadrilateral(replacementLog) {
        const segmentIndexQueue = new Set(this._internalSegmentList);

        for (const segmentIndex of segmentIndexQueue) {
            segmentIndexQueue.delete(segmentIndex);

            const segment = this._segments[segmentIndex];
            const convexHulls = this.selectConvexHulls(segment, [4]);
            const influencedSegmentAddList = [];
            const influencedSegmentDeleteList = [];
            for (const convexHull of convexHulls) {
                this.fineTuneConvexHull(convexHull, replacementLog, influencedSegmentAddList, influencedSegmentDeleteList);
            }
            for (const influencedSegmentIndex of influencedSegmentAddList) {
                if (this._boundingSegmentList.has(influencedSegmentIndex)) {
                    continue;
                }

                segmentIndexQueue.add(influencedSegmentIndex);
            }
        }
    }

    fineTuneForConvexPentagon(replacementLog) {
        const segmentIndexQueue = new Set(this._internalSegmentList);

        for (const segmentIndex of segmentIndexQueue) {
            segmentIndexQueue.delete(segmentIndex);

            const segment = this._segments[segmentIndex];
            const convexHulls = this.selectConvexHulls(segment, [5]);
            const influencedSegmentAddList = [];
            const influencedSegmentDeleteList = [];
            for (const convexHull of convexHulls) {
                if (this.fineTuneConvexHull(convexHull, replacementLog, influencedSegmentAddList, influencedSegmentDeleteList)) {
                    break;
                }
            }
            for (const influencedSegmentIndex of influencedSegmentDeleteList) {
                segmentIndexQueue.delete(influencedSegmentIndex);
            }
            for (const influencedSegmentIndex of influencedSegmentAddList) {
                if (this._boundingSegmentList.has(influencedSegmentIndex)) {
                    continue;
                }

                segmentIndexQueue.add(influencedSegmentIndex);
            }
        }
    }

    handleFineTuneForQuadrilateral() {
        const replacementLog = [];
        this.fineTuneForConvexQuadrilateral(replacementLog);

        const internalSegmentList = [...this._internalSegmentList];
        const internalSegmentTotalLength = this.totalLength(internalSegmentList);

        return [
            replacementLog.map(i => [this.segmentIndex(...i[0]), this.segmentIndex(...i[1]), i[2]]),
            internalSegmentList,
            internalSegmentTotalLength];
    }

    handleFineTuneForPentagon() {
        const replacementLog = [];
        this.fineTuneForConvexPentagon(replacementLog);

        const internalSegmentList = [...this._internalSegmentList];
        const internalSegmentTotalLength = this.totalLength(internalSegmentList);

        return [
            replacementLog.map(i => [this.segmentIndex(...i[0]), this.segmentIndex(...i[1]), i[2]]),
            internalSegmentList,
            internalSegmentTotalLength];
    }

    shuffle() {
        const segmentQueue = [...this._internalSegmentList.values()];
        const replacementLog = [];

        for (let k = 0; k < this._internalSegmentList.size;) {
            const randomIndex = this._randomEngine.next() % segmentQueue.length;
            const segmentIndex = segmentQueue[randomIndex];
            const segment = this._segments[segmentIndex];

            const convexHulls = this.selectConvexHulls(segment, [4]);
            for (const convexHull of convexHulls) {
                const influencedSegmentAddList = [];
                this.shuffleConvexHull(convexHull, replacementLog, influencedSegmentAddList);
                segmentQueue.splice(randomIndex, 1, influencedSegmentAddList[0]);
                k++;
            }
        }

        const internalSegmentList = [...this._internalSegmentList];
        const internalSegmentTotalLength = this.totalLength(internalSegmentList);

        return [
            replacementLog.map(i => [this.segmentIndex(...i[0]), this.segmentIndex(...i[1]), i[2]]),
            internalSegmentList,
            internalSegmentTotalLength];
    }

    points() {
        return [...this._points];
    }

    getSegment(segmentIndex) {
        return this._segments[segmentIndex].map(i => this._points[i]);
    }
}

class AnimationLine extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            startTimestamp: NaN,
            scale: 0.0
        };
        this.animateFrame = this.animateFrame.bind(this);
    }

    componentDidMount() {
        this.rafId = requestAnimationFrame(this.animateFrame);
    }

    componentWillUnmount() {
        cancelAnimationFrame(this.rafId);
    }

    animateFrame(time) {
        if (isNaN(this.state.startTimestamp)) {
            this.setState({
                startTimestamp: time
            }, () => {
                this.rafId = requestAnimationFrame(this.animateFrame);
            });
        } else {
            const timeElapsed = time - this.state.startTimestamp;
            const scale = Math.max(0.0, (timeElapsed - this.props.quiescentTime) / this.props.animatingTime);
            if (scale < 1.0) {
                this.setState({ scale }, () => {
                    this.rafId = requestAnimationFrame(this.animateFrame);
                });
            } else {
                this.props.stop();
            }
        }
    }

    render() {
        return <line
            x1={this.props.x1 * (1.0 - this.state.scale) + this.props.x3 * this.state.scale}
            y1={this.props.y1 * (1.0 - this.state.scale) + this.props.y3 * this.state.scale}
            x2={this.props.x2 * (1.0 - this.state.scale) + this.props.x4 * this.state.scale}
            y2={this.props.y2 * (1.0 - this.state.scale) + this.props.y4 * this.state.scale}
            stroke={this.props.stroke}
            strokeWidth={this.props.strokeWidth} />
    }
}

class App extends React.Component {
    constructor(props) {
        super(props);
        this.randomEngine = new RandomEngine();
        this.state = {
            pointNumber: 9,
            points: [],
            boundingLineList: [],
            internalLineList: new Set(),
            internalLineTotalLength: 0.0,
            connectionSchemeRecords: [],
            activeRecordIndex: -1,
            replaying: false,
            replacementLog: [],
            currentReplayRow: 0,
            replayAnimationDuration: 1000,
            showPoint: true,
            showReplay: true,
            showPointLabel: false,
            showEdgeLabel: false
        };
        this.handlePointNumberChange = this.handlePointNumberChange.bind(this);
        this.handleRandomGeneratePoints = this.handleRandomGeneratePoints.bind(this);
        this.handleImportPoints = this.handleImportPoints.bind(this);
        this.handleExportPoints = this.handleExportPoints.bind(this);
        this.handleShowPointChange = this.handleShowPointChange.bind(this);
        this.handleShowReplayChange = this.handleShowReplayChange.bind(this);
        this.handleShowPointLabelChange = this.handleShowPointLabelChange.bind(this);
        this.handleShowEdgeLabelChange = this.handleShowEdgeLabelChange.bind(this);
        this.handleFineTuneForQuadrilateral = this.handleFineTuneForQuadrilateral.bind(this);
        this.handleFineTuneForPentagon = this.handleFineTuneForPentagon.bind(this);
        this.handleShuffle = this.handleShuffle.bind(this);
        this.handleAnimationStop = this.handleAnimationStop.bind(this);
        this.handleAnimationSpeedUp = this.handleAnimationSpeedUp.bind(this);
        this.handleAnimationSpeedDown = this.handleAnimationSpeedDown.bind(this);
        this.handleRecordShow = this.handleRecordShow.bind(this);
        this.handleRecordDelete = this.handleRecordDelete.bind(this);
    }

    initialize(points, boundingLineList, callback) {
        this.setState({
            points,
            boundingLineList,
            internalLineList: new Set(),
            internalLineTotalLength: 0.0,
            connectionSchemeRecords: [],
            activeRecordIndex: -1,
            replaying: false
        }, callback);
    }

    showConnectionScheme(internalLineList, internalLineTotalLength) {
        this.setState(state => {
            state.replaying = false;
            state.internalLineList = new Set(internalLineList);
            state.internalLineTotalLength = internalLineTotalLength;
            state.connectionSchemeRecords.push({
                internalLineList,
                internalLineTotalLength,
                visible: true
            });
            state.activeRecordIndex = state.connectionSchemeRecords.length - 1;
            return state;
        });
    }

    showConnectionSchemeWithReplay(replacementLog, internalLineList, internalLineTotalLength) {
        this.setState(state => {
            if (state.showReplay && replacementLog.length !== 0) {
                if (state.activeRecordIndex !== state.connectionSchemeRecords.length - 1) {
                    const record = state.connectionSchemeRecords[state.connectionSchemeRecords.length - 1];
                    state.internalLineList = new Set(record.internalLineList);
                    state.internalLineTotalLength = record.internalLineTotalLength;
                }
                state.replaying = true;
            } else {
                state.internalLineList = new Set(internalLineList);
                state.internalLineTotalLength = internalLineTotalLength;
            }
            state.replacementLog = replacementLog;
            state.currentReplayRow = 0;
            state.connectionSchemeRecords.push({
                internalLineList,
                internalLineTotalLength,
                visible: true
            });
            state.activeRecordIndex = state.connectionSchemeRecords.length - 1;
            return state;
        });
    }

    createNewScheme(points) {
        console.clear();
        this.network = new Network(points, this.randomEngine);
        const [boundingLineList, internalLineList, internalLineTotalLength] = this.network.buildConnectionScheme();
        this.initialize(this.network.points(), boundingLineList, () => {
            this.showConnectionScheme(internalLineList, internalLineTotalLength);
        });
    }

    handleAnimationStop() {
        this.setState(state => {
            if (!state.showReplay) {
                state.replaying = false;
            }
            if (state.replaying) {
                const replacementLogRow = state.replacementLog[state.currentReplayRow];
                state.internalLineList.delete(replacementLogRow[0]);
                state.internalLineList.add(replacementLogRow[1]);
                state.internalLineTotalLength += replacementLogRow[2];
                state.currentReplayRow += 1;
                if (state.currentReplayRow === state.replacementLog.length) {
                    state.replaying = false;
                }
            }
            if (!state.replaying) {
                const record = state.connectionSchemeRecords[state.connectionSchemeRecords.length - 1];
                state.internalLineList = new Set(record.internalLineList);
                state.internalLineTotalLength = record.internalLineTotalLength;
            }
            return state;
        });
    }

    handlePointNumberChange(e) {
        if (e.target.value >= 0 && e.target.value <= 1024) {
            this.setState({
                pointNumber: e.target.value
            });
        }
    }

    handleRandomGeneratePoints() {
        this.createNewScheme(generatePoints(this.randomEngine, this.state.pointNumber));
    }

    handleImportPoints() {
        const pointText = prompt('Points JSON string:');
        this.createNewScheme(JSON.parse(pointText));
    }

    handleExportPoints() {
        const pointText = JSON.stringify(this.state.points);
        navigator.clipboard.writeText(pointText).then(() => alert('Export points data to clipboard successfully!'));
    }


    handleShowPointChange(e) {
        this.setState({ showPoint: e.target.checked });
    }

    handleShowReplayChange(e) {
        this.setState({ showReplay: e.target.checked });
    }

    handleShowPointLabelChange(e) {
        this.setState({ showPointLabel: e.target.checked });
    }

    handleShowEdgeLabelChange(e) {
        this.setState({ showEdgeLabel: e.target.checked });
    }

    handleFineTuneForQuadrilateral() {
        const [replacementLog, internalLineList, internalLineTotalLength] = this.network.handleFineTuneForQuadrilateral();
        if (replacementLog.length !== 0) {
            this.showConnectionSchemeWithReplay(
                replacementLog,
                internalLineList,
                internalLineTotalLength);
        }
    }

    handleFineTuneForPentagon() {
        const [replacementLog, internalLineList, internalLineTotalLength] = this.network.handleFineTuneForPentagon();
        if (replacementLog.length !== 0) {
            this.showConnectionSchemeWithReplay(
                replacementLog,
                internalLineList,
                internalLineTotalLength);
        }
    }

    handleShuffle() {
        const [replacementLog, internalLineList, internalLineTotalLength] = this.network.shuffle();
        this.showConnectionSchemeWithReplay(
            replacementLog,
            internalLineList,
            internalLineTotalLength);
    }

    handleRecordShow(e) {
        const index = parseInt(e.target.dataset.tag);
        this.setState(state => {
            const record = state.connectionSchemeRecords[index];
            state.replaying = false;
            state.internalLineList = new Set(record.internalLineList);
            state.internalLineTotalLength = record.internalLineTotalLength;
            state.activeRecordIndex = index;
            return state;
        });
    }

    handleRecordDelete(e) {
        const index = parseInt(e.target.dataset.tag);
        this.setState(state => {
            state.connectionSchemeRecords[index].visible = false;
            return state;
        });
    }

    handleAnimationSpeedUp() {
        this.setState(state => {
            if (state.replayAnimationDuration > 100) {
                state.replayAnimationDuration *= 0.8;
            }
            return state;
        });
    }

    handleAnimationSpeedDown() {
        this.setState(state => {
            if (state.replayAnimationDuration < 4000) {
                state.replayAnimationDuration *= 1.25;
            }
            return state;
        });
    }

    componentDidMount() {
        this.handleRandomGeneratePoints();
    }

    renderBoundingLines() {
        return this.state.boundingLineList.map(lineIndex => {
            const line = this.network.getSegment(lineIndex);
            return <React.Fragment key={lineIndex}>
                <line
                    x1={line[0].x * this.props.width}
                    y1={line[0].y * this.props.height}
                    x2={line[1].x * this.props.width}
                    y2={line[1].y * this.props.height} stroke="black" strokeWidth="1.5" />
                {this.state.showEdgeLabel && <text
                    x={(line[0].x + line[1].x) / 2 * this.props.width}
                    y={(line[0].y + line[1].y) / 2 * this.props.height} stroke="blue">{lineIndex}</text>}
            </React.Fragment>;
        });
    }

    renderInternalLines() {
        return [...this.state.internalLineList]
            .map(lineIndex => {
                const line = this.network.getSegment(lineIndex);
                return <React.Fragment key={lineIndex}>
                    <line
                        x1={line[0].x * this.props.width}
                        y1={line[0].y * this.props.height}
                        x2={line[1].x * this.props.width}
                        y2={line[1].y * this.props.height} stroke="silver" strokeWidth="1.5" />
                    {this.state.showEdgeLabel && <text
                        x={(line[0].x + line[1].x) / 2 * this.props.width}
                        y={(line[0].y + line[1].y) / 2 * this.props.height} stroke="blue">{lineIndex}</text>}
                </React.Fragment>;
            });
    }

    renderReplacementAnimation() {
        if (this.state.replaying) {
            const oldLine = this.network.getSegment(this.state.replacementLog[this.state.currentReplayRow][0]);
            const newLine = this.network.getSegment(this.state.replacementLog[this.state.currentReplayRow][1]);
            return <React.Fragment>
                <polygon
                    points={`${oldLine[0].x * this.props.width},${oldLine[0].y * this.props.height} ${newLine[0].x * this.props.width},${newLine[0].y * this.props.height} ${oldLine[1].x * this.props.width},${oldLine[1].y * this.props.height} ${newLine[1].x * this.props.width},${newLine[1].y * this.props.height}`}
                    fill="lightyellow" stroke="grey" strokeWidth="1.5" />
                <AnimationLine key={this.state.currentReplayRow}
                    x1={oldLine[0].x * this.props.width} y1={oldLine[0].y * this.props.height}
                    x2={oldLine[1].x * this.props.width} y2={oldLine[1].y * this.props.height}
                    x3={newLine[0].x * this.props.width} y3={newLine[0].y * this.props.height}
                    x4={newLine[1].x * this.props.width} y4={newLine[1].y * this.props.height}
                    quiescentTime={this.state.replayAnimationDuration * 0.2} animatingTime={this.state.replayAnimationDuration * 0.8}
                    stroke="silver" strokeWidth="2"
                    stop={this.handleAnimationStop} />
            </React.Fragment>;
        }
    }

    renderPoints() {
        return this.state.points.map((point, pointIndex) => <React.Fragment key={pointIndex}>
            <circle cx={point.x * this.props.width} cy={point.y * this.props.height} r="3" fill="red" />
            {this.state.showPointLabel && <text x={point.x * this.props.width} y={point.y * this.props.height} stroke="brown">{pointIndex}</text>}
        </React.Fragment>);
    }

    render() {
        return <React.Fragment>
            <div>
                <span>Triangulation for <input type="number" value={this.state.pointNumber} onChange={this.handlePointNumberChange} /> vertices&nbsp;&nbsp;</span>
                <button onClick={this.handleRandomGeneratePoints}>Random generate</button>
                <span>&nbsp;&nbsp;</span>
                <button onClick={this.handleImportPoints}>Import</button>
                <span>&nbsp;&nbsp;</span>
                <button onClick={this.handleExportPoints}>Export</button>
                <span>&nbsp;&nbsp;</span>
                <span><button onClick={this.handleFineTuneForQuadrilateral} disabled={this.state.replaying}>Fine tune for quadrilaterals</button></span>
                <span>&nbsp;&nbsp;</span>
                <span><button onClick={this.handleFineTuneForPentagon} disabled={this.state.replaying}>Fine tune for pentagons</button></span>
                <span>&nbsp;&nbsp;</span>
                <span><button onClick={this.handleShuffle} disabled={this.state.replaying}>Shuffle</button></span>
            </div>
            <div className="container">
                <div>
                    <svg width={this.props.width} height={this.props.height} xmlns="http://www.w3.org/2000/svg">
                        <g>
                            {this.renderInternalLines()}
                            {this.renderReplacementAnimation()}
                            {this.renderBoundingLines()}
                            {this.state.showPoint && this.renderPoints()};
                    </g>
                    </svg>
                    {this.state.replaying && <p>
                        <span>Steps: {this.state.currentReplayRow}/{this.state.replacementLog.length}</span>
                        <span>,&nbsp;&nbsp;</span>
                        <span>Animation speed: <button onClick={this.handleAnimationSpeedUp}>+</button>&nbsp;<button onClick={this.handleAnimationSpeedDown}>-</button></span>
                    </p>}
                </div>

                <div>
                    <div className="legend">
                        <b>Parameters:</b>
                        <p>Vertex number: {this.state.points.length}</p>
                        <p>Edge number: {this.state.boundingLineList.length + this.state.internalLineList.size}</p>
                        <p>Edge total length: {this.state.internalLineTotalLength.toFixed(4)}</p>
                        <p>Triangle number: {(this.state.boundingLineList.length + this.state.internalLineList.size * 2) / 3}</p>
                    </div>
                    <div className="legend">
                        <b>Options:</b>
                        <p>Show replays: <input type="checkbox" checked={this.state.showReplay} onChange={this.handleShowReplayChange} /></p>
                        <p>Show points: <input type="checkbox" checked={this.state.showPoint} onChange={this.handleShowPointChange} /></p>
                        <p>Show point labels: <input type="checkbox" checked={this.state.showPointLabel} onChange={this.handleShowPointLabelChange} /></p>
                        <p>Show edge labels: <input type="checkbox" checked={this.state.showEdgeLabel} onChange={this.handleShowEdgeLabelChange} /></p>
                    </div>
                    <div className="legend">
                        <b>Records:</b>
                        <table>
                            <thead>
                                <tr>
                                    <td>No.</td>
                                    <td>Total length</td>
                                </tr>
                            </thead>
                            <tbody>
                                {this.state.connectionSchemeRecords.map((item, index) => item.visible && <tr key={index}>
                                    <td>{this.state.activeRecordIndex === index ?
                                        <span>{index.toString().padStart(5, '0')}</span> :
                                        <a href="#" onClick={this.handleRecordShow} data-tag={index}>{index.toString().padStart(5, '0')}</a>}</td>
                                    <td>{item.internalLineTotalLength.toFixed(4)}</td>
                                    <td>{this.state.activeRecordIndex !== index && <button onClick={this.handleRecordDelete} data-tag={index}>X</button>}</td>
                                </tr>)}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </React.Fragment>;
    }
}

ReactDOM.render(<App width={960} height={960} />, document.querySelector('#root'));