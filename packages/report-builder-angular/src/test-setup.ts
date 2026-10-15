// JIT for the tests: the analog plugin compiles the components, and the
// partially compiled Angular packages are linked at run time by the
// compiler imported here.
import '@angular/compiler'
import { getTestBed } from '@angular/core/testing'
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing'

getTestBed().initTestEnvironment(BrowserTestingModule, platformBrowserTesting())
