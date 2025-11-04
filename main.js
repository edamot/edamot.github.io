class CanvasWindow {
    constructor() {
        this.canvas = document.getElementById("canvas");
        this.ctx = this.canvas.getContext("2d");

        this.cellSizeLevel = 4;
        this.cellSize = 2 ** this.cellSizeLevel;
        this.halfCellSize = this.cellSize / 2;
        this.wallHeight = 32;
        this.map = [
            [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
            [1,1,0,0,0,0,0,0,0,0,0,1,0,0,0,1],
            [1,0,0,0,0,0,0,1,0,0,0,0,0,0,0,1],
            [1,0,0,0,1,1,0,0,0,1,1,0,0,0,1,1],
            [1,0,0,1,1,1,0,0,1,1,1,0,0,1,1,1],
            [1,0,0,1,1,0,0,0,1,1,0,0,0,1,1,1],
            [1,0,0,0,0,0,1,0,0,0,0,0,0,0,0,1],
            [1,0,1,0,0,0,0,0,0,0,0,0,1,0,0,1],
            [1,0,0,0,1,1,0,0,0,1,1,0,0,0,1,1],
            [1,0,0,1,1,1,0,0,1,1,1,0,0,1,1,1],
            [1,0,0,1,1,0,0,0,1,1,0,0,0,1,1,1],
            [1,1,0,0,0,0,0,0,0,0,0,1,0,0,0,1],
            [1,0,0,0,0,0,0,1,0,0,0,0,0,0,0,1],
            [1,0,0,0,1,1,0,0,0,1,1,0,0,0,1,1],
            [1,0,0,1,1,1,0,0,1,1,1,0,0,1,1,1],
            [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1]
        ]
        const imageWidthLevel = 5;
        const patternSizeLevel = 4;
        this.mouseSensitivity = 1 / 4
        this.camera = {
            position: {
                x: this.cellSize * 3 - this.halfCellSize,
                y: this.cellSize * 3 - this.halfCellSize
            },
            // degrees.
            angle: 0,
            fov: 60
        }

        this.camera.posInCell = {
            x: this.camera.position.x % this.cellSize,
            y: this.camera.position.y % this.cellSize
        }
        this.camera.posCell = {
            x: Math.trunc(this.camera.position.x) >> this.cellSizeLevel,
            y: Math.trunc(this.camera.position.y) >> this.cellSizeLevel
        }
        // add 0.01 degrees to avoid the value that not expected.
        this.camera.vector = {
            // x: Math.cos((this.camera.angle + 0.01) / 180 * Math.PI),
            // y: Math.sin((this.camera.angle + 0.01) / 180 * Math.PI)
            x: Math.cos(this.camera.angle / 180 * Math.PI),
            y: Math.sin(this.camera.angle / 180 * Math.PI)
        }
        this.camera.fovReciprocal = 1 / this.camera.fov;

        this.screen = {
            resolution: {
                width: this.canvas.width,
                height: this.canvas.height
            },
            resolutionReciprocal: 1 / (this.canvas.width - 1),
            size: {
                halfWidth: Math.tan(this.camera.fov / 2 / 180 * Math.PI)
            }
        }
        this.screen.size.width = this.screen.size.halfWidth * 2
        this.screen.size.height = this.screen.size.width * this.canvas.height / this.canvas.width;
        this.screen.vector = {
            x: - this.camera.vector.y * this.screen.size.halfWidth,
            y: this.camera.vector.x * this.screen.size.halfWidth
        }

        this.rayVec = {
            x: [],
            y: []
        }
        for (let i = 0; i < this.screen.resolution.width; i++) {
            this.rayVec.x[i] = this.camera.vector.x + this.screen.vector.x * (i * this.screen.resolutionReciprocal * 2 - 1 );
            this.rayVec.y[i] = this.camera.vector.y + this.screen.vector.y * (i * this.screen.resolutionReciprocal * 2 - 1 );
        }

        //  create ImageData object for texture of wall.
        this.imageWidth = 2 ** imageWidthLevel;
        this.imageHeight = this.wallHeight * 2 ** (imageWidthLevel - this.cellSizeLevel);
        const patternSize = 2 ** patternSizeLevel;
        this.image = this.ctx.createImageData(this.imageWidth, this.imageHeight);
        for (let i = 0; i < this.image.data.length; i += 4 * this.imageWidth * patternSize){
            for (let j = 0, rowInPattern = 0; j < 4 * this.imageWidth * patternSize; j += 4 * this.imageWidth, rowInPattern ++){
                for (let k = 0; k < 4 * this.imageWidth; k += 4 * patternSize) {
                    for (let l = 0, columnInPattern = 0; l <= 4 * patternSize; l += 4, columnInPattern ++) {
                        this.image.data[i + j + k + l] = 239 - 2 * (columnInPattern + rowInPattern);
                        this.image.data[i + j + k + l + 1] = 239 - 2 * (columnInPattern + rowInPattern);
                        this.image.data[i + j + k + l + 2] = 239 - 2 * (columnInPattern + rowInPattern);
                        this.image.data[i + j + k + l + 3] = 255;
                    }
                }
            }
        }
        // create bitmap from ImageData.
        this.image = createImageBitmap(this.image);

        // listen keyboard event and record it in array to move camera.
        this.keyStatus = [0, 0, 0, 0];
        this.nextCamera = {
            position: {
                x: this.camera.position.x,
                y: this.camera.position.y
            },
            posInCell: {},
            posCell: {}
        }
    }

    rayCast() {
        let distance2Wall = [];
        let sourceTextureX = [];
        let signRayVec = {
            x: 0,
            y: 0
        };
        let hitFrom = {
            xSide: 0,
            ySide: 0
        };

        // loop to cast the rays as many time as the number of canvas window's width.
        for (let i = 0; i < this.screen.resolution.width; i++) {
            signRayVec.x = Math.sign(this.rayVec.x[i]);
            signRayVec.y = Math.sign(this.rayVec.y[i]);
            let reachedCell = {
                x: this.camera.posCell.x,
                y: this.camera.posCell.y
            }
            let previousCell = {
                x: reachedCell.x,
                y: reachedCell.y
            }
            // calculate x, y component between the camera and the next cell of the map matrix. 
            this.camera.posInCell.x = this.camera.position.x % this.cellSize;
            this.camera.posInCell.y = this.camera.position.y % this.cellSize;
            const initRayDist = {
                x: signRayVec.x * (this.cellSize - this.camera.posInCell.x - this.halfCellSize + signRayVec.x * this.halfCellSize),
                y: signRayVec.y * (this.cellSize - this.camera.posInCell.y - this.halfCellSize + signRayVec.y * this.halfCellSize)
            }

            // loop to look for the wall. it move the ray foward until the ray hit the wall.
            for (let hit = 0, j = 0; hit == 0 && j <= 27; j ++) {
                const point2DecideNextCell = {
                    x: reachedCell.x * this.cellSize + this.halfCellSize + signRayVec.x * this.halfCellSize,
                    y: reachedCell.y * this.cellSize + this.halfCellSize + signRayVec.y * this.halfCellSize
                }
                const value2DecideNextCell = Math.sign(this.rayVec.x[i] * (point2DecideNextCell.y - this.camera.position.y) + this.rayVec.y[i] * (this.camera.position.x - point2DecideNextCell.x));
                previousCell.x = reachedCell.x;
                previousCell.y = reachedCell.y;
                reachedCell.x = reachedCell.x + !!(value2DecideNextCell * signRayVec.x * signRayVec.y + 1) * signRayVec.x;
                reachedCell.y = reachedCell.y + !!(-(value2DecideNextCell * signRayVec.x * signRayVec.y) + 1) * signRayVec.y;
                hit = this.map[reachedCell.y][reachedCell.x];
            }
            hitFrom.xSide = Math.abs(reachedCell.x - previousCell.x);
            hitFrom.ySide = Math.abs(reachedCell.y - previousCell.y);

            distance2Wall[i] = hitFrom.xSide * ((Math.abs(reachedCell.x - this.camera.posCell.x) - 1) * this.cellSize + initRayDist.x) / Math.abs(this.rayVec.x[i]) + hitFrom.ySide * ((Math.abs(reachedCell.y - this.camera.posCell.y) - 1) * this.cellSize + initRayDist.y) / Math.abs(this.rayVec.y[i]);
            const hitPoint = hitFrom.ySide * ((Math.abs(this.rayVec.x[i]) * distance2Wall[i] - initRayDist.x) % this.cellSize) + hitFrom.xSide * ((Math.abs(this.rayVec.y[i]) * distance2Wall[i] - initRayDist.y) % this.cellSize);
            sourceTextureX[i] = Math.trunc((hitFrom.ySide * ((this.cellSize - signRayVec.x * signRayVec.y * hitPoint) % this.cellSize) + hitFrom.xSide * ((this.cellSize + signRayVec.x * signRayVec.y * hitPoint) % this.cellSize)) / this.cellSize * this.imageWidth);
        }
        return [distance2Wall, sourceTextureX];
    }

    drawWall() {
        const [dist2Wall, sourceX] = this.rayCast();
        for (let i in dist2Wall) {
            const drawHeight = this.wallHeight * this.screen.resolution.height / (dist2Wall[i] * this.screen.size.height);
            const drawY = (this.screen.resolution.height - drawHeight) / 2;
            this.ctx.imageSmoothingEnabled = false;
            this.image.then((sourceImage) => {
                this.ctx.drawImage(sourceImage, sourceX[i], 0, 1, this.imageHeight, i, drawY, 1, drawHeight);
            }, () => {
                console.log(`${i}: didn't draw`)
            });
        }
    }

    moveCameraByKeyboard() {
        this.nextCamera.position.x = this.nextCamera.position.x + this.keyStatus[0] * this.camera.vector.x + this.keyStatus[1] * this.camera.vector.y - this.keyStatus[2] * this.camera.vector.x - this.keyStatus[3] * this.camera.vector.y;
        this.nextCamera.position.y = this.nextCamera.position.y + this.keyStatus[0] * this.camera.vector.y - this.keyStatus[1] * this.camera.vector.x - this.keyStatus[2] * this.camera.vector.y + this.keyStatus[3] * this.camera.vector.x;
        this.nextCamera.posInCell = {
            x: this.nextCamera.position.x % this.cellSize,
            y: this.nextCamera.position.y % this.cellSize
        }
        this.nextCamera.posCell = {
            x: Math.trunc(this.nextCamera.position.x) >> this.cellSizeLevel,
            y: Math.trunc(this.nextCamera.position.y) >> this.cellSizeLevel
        }

        this.nextCamera.posCell.isWall = this.map[this.nextCamera.posCell.y][this.nextCamera.posCell.x] == 1;

        this.nextCamera.position.x = (!this.nextCamera.posCell.isWall && this.nextCamera.position.x) || (this.nextCamera.posCell.isWall && this.camera.position.x);
        this.nextCamera.position.y = (!this.nextCamera.posCell.isWall && this.nextCamera.position.y) || (this.nextCamera.posCell.isWall && this.camera.position.y);
        this.camera.position.x = (!this.nextCamera.posCell.isWall && this.nextCamera.position.x) || (this.nextCamera.posCell.isWall && this.camera.position.x);
        this.camera.position.y = (!this.nextCamera.posCell.isWall && this.nextCamera.position.y) || (this.nextCamera.posCell.isWall && this.camera.position.y);
        this.camera.posCell.x = (!this.nextCamera.posCell.isWall && this.nextCamera.posCell.x) || (this.nextCamera.posCell.isWall && this.camera.posCell.x);
        this.camera.posCell.y = (!this.nextCamera.posCell.isWall && this.nextCamera.posCell.y) || (this.nextCamera.posCell.isWall && this.camera.posCell.y);
        this.camera.posInCell.x = (!this.nextCamera.posCell.isWall && this.nextCamera.posInCell.x) || (this.nextCamera.posCell.isWall && this.camera.posInCell.x);
        this.camera.posInCell.y = (!this.nextCamera.posCell.isWall && this.nextCamera.posInCell.y) || (this.nextCamera.posCell.isWall && this.camera.posInCell.y);
    }

    main() {
        window.requestAnimationFrame(() => this.main());
        this.ctx.fillStyle = "rgb(0, 0, 0)";
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        this.drawWall();
        this.moveCameraByKeyboard();
    }

    start() {
        const self = this;
        console.log(self);
        window.addEventListener("keydown", recordKeyDown);
        function recordKeyDown(e) {
            self.keyStatus[0] = self.keyStatus[0] || e.key === "w";
            self.keyStatus[1] = self.keyStatus[1] || e.key === "a";
            self.keyStatus[2] = self.keyStatus[2] || e.key === "s";
            self.keyStatus[3] = self.keyStatus[3] || e.key === "d";
        }
        window.addEventListener("keyup", recordKeyUp);
        function recordKeyUp(e) {
            self.keyStatus[0] = self.keyStatus[0] && !(e.key === "w");
            self.keyStatus[1] = self.keyStatus[1] && !(e.key === "a");
            self.keyStatus[2] = self.keyStatus[2] && !(e.key === "s");
            self.keyStatus[3] = self.keyStatus[3] && !(e.key === "d");
        }

        this.canvas.onclick = () => {
            this.canvas.requestPointerLock();
        };
        document.addEventListener("pointerlockchange", () => {
            document.pointerLockElement === canvas && document.addEventListener("mousemove", rotateByMouse, false) || !(document.pointerLockElement === canvas) && (document.removeEventListener("mousemove", rotateByMouse, false));
        }, false);
        function rotateByMouse(e) {
            self.camera.angle += e.movementX * self.mouseSensitivity;
            // self.camera.vector.x = Math.cos((self.camera.angle + 0.01) / 180 * Math.PI);
            self.camera.vector.x = Math.cos((self.camera.angle) / 180 * Math.PI);
            // self.camera.vector.y = Math.sin((self.camera.angle + 0.01) / 180 * Math.PI);
            self.camera.vector.y = Math.sin((self.camera.angle) / 180 * Math.PI);
            self.screen.vector.x = - self.camera.vector.y * self.screen.size.halfWidth;
            self.screen.vector.y = self.camera.vector.x * self.screen.size.halfWidth;
            for (let i = 0; i < self.screen.resolution.width; i++) {
                self.rayVec.x[i] = self.camera.vector.x + self.screen.vector.x * (i * self.screen.resolutionReciprocal * 2 - 1 );
                self.rayVec.y[i] = self.camera.vector.y + self.screen.vector.y * (i * self.screen.resolutionReciprocal * 2 - 1 );
            }
        }
        window.requestAnimationFrame(() => this.main());
    }
}


const cw = new CanvasWindow();
cw.start();