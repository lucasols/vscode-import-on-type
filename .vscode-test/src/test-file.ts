import {
  appendFileSync,
  copyFileSync,
  exists,
  existsSync,
  lstatSync,
  mkdir,
  mkdirSync,
  readFile,
  rmdir,
  rmdirSync,
  stat,
  statSync,
  writeFile,
} from 'fs'

const array = [1, 2, 3]

array.forEach((item) => {
  console.log(item)
})

array.forEach((item) => {
  console.log(item)
})
const ok = true

try {
  // do something
} catch (error) {
  // handle error
}

console.log(
  stat,
  lstatSync,
  statSync,
  exists,
  existsSync,
  mkdir,
  mkdirSync,
  rmdir,
  rmdirSync,
  copyFileSync,
  appendFileSync,
  writeFile,
  readFile,
)
