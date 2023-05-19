import { createRequire } from "module"
import { dirname } from 'path'
import { fileURLToPath } from 'url'
const require = createRequire(import.meta.url)
const express = require('express')
const path = require('path')
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const __supportFileSize = 40 // Mb

const PORT = process.env.PORT || 5000

import Editly from "editly"

const { v4: uuidv4 } = require('uuid')

const fs = require('fs')

const multer = require('multer')
const upload = multer({
  dest: '/tmp',
  fileSize: __supportFileSize * 1024 * 1024,
  fieldNameSize: 255,
})

const unlinkRecent = async (files) => {
  for (let file of Object.values(files)) {
    fs.unlink(file[0].path, err => {})
  }
}

express()
.use(express.static(path.join(__dirname, 'public')))
.set('view engine', 'ejs')
.set('views', './views')

.get('/', (req, res) => {
    res.render('pages/index')
})

.post('/upload', upload.fields([
  {name: 'media1'},
  {name: 'media2'},
  {name: 'media3'}
]), async (req, res) => {

  if ( Object.values(req.files).length == 0 ) {
    res.status(400).send({error: 'At least one video file is required.'});
    unlinkRecent(req.files);
    return;
  }

  if ( ![1,2,3,4].includes(parseInt(req.body.format)) ) {
    res.status(400).send({error: 'Please select an output video format!'});
    unlinkRecent(req.files);
    return;
  }
  
  for (let element of Object.values(req.files)) {
    
    if (element[0].mimetype != 'video/mp4') {
      res.status(400).send({error: '"' + element[0].originalname + '" video format is not supported!<br>' + 'Only .mp4 video format is supported.'});
      unlinkRecent(req.files);
      return;
    }

    if ( (element[0].size / (1024*1024)) > __supportFileSize ) {
      res.status(400).send({error: '"' + element[0].originalname + '" video size must be lower than '+ __supportFileSize +' Mb'});
      unlinkRecent(req.files);
      return;
    }

  };

  // all good, start processing 👇

  let myClips = [];
  let download = uuidv4();
  let videoFormat = parseInt(req.body.format);
  for (let clip of Object.values(req.files)) {
    if(clip[0]) {
      myClips.push({ layers: [{
        type: 'video',
        path: clip[0].path,
        mixVolume: 1,
        cutFrom: clip[0].fieldname=='media1' ? JSON.parse(req.body.cut1).from :
                  clip[0].fieldname=='media2' ? JSON.parse(req.body.cut2).from :
                  clip[0].fieldname=='media3' ? JSON.parse(req.body.cut3).from :
                  null
                  ,
        cutTo: clip[0].fieldname=='media1' ? JSON.parse(req.body.cut1).to :
                clip[0].fieldname=='media2' ? JSON.parse(req.body.cut2).to :
                clip[0].fieldname=='media3' ? JSON.parse(req.body.cut3).to :
                null
                ,
      }] },);
    } 
  };
  const videoSizes = [
    {w:1080, h:1350},
    {w:1080, h:1080},
    {w:1080, h:1920},
    {w:1920, h:1080}
  ];

  try {
    await Editly(
        {
            outPath: '/tmp/'+ download +'.mp4',
            width: videoSizes[videoFormat-1].w,
            height: videoSizes[videoFormat-1].h,
            fps: 30,
            allowRemoteRequests: false,
            defaults: {
              duration: 10,
              transition: {
                duration: 0.5,
                name: req.body.transition, // https://gl-transitions.com/gallery
                audioOutCurve: 'tri',
                audioInCurve: 'tri',
              },
            },
            clips: myClips,
            // audioFilePath: './editly/examples/assets/High [NCS Release] - JPB  (No Copyright Music)-R8ZRCXy5vhA.m4a',
            loopAudio: false,
            keepSourceAudio: true,
            clipsAudioVolume: 1,
            outputVolume: 1,
            audioNorm: {
              enable: false,
              gaussSize: 5,
              maxGain: 30,
            },
            enableFfmpegLog: false,
            verbose: false,
            fast: false,
        }
    ).finally(() => {
      unlinkRecent(req.files);
    })
    res.download('/tmp/'+ download +'.mp4');
    res.status(200);
  } catch (error) {
    if (error.toString().includes("Cannot read property 'glsl' of")) {
      res.status(400).send({error: 'The selected transition effect is not available!'});
    } else {
      res.status(400).send({error: 'Something went wrong. Please try again later!'});
    }
    unlinkRecent(req.files);
    return;
  }
  
})

.listen(PORT, () => console.log(`Listening on ${ PORT }:\n👉 http://localhost:${ PORT }`))
