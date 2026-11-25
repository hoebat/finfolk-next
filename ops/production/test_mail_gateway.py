import importlib.util
from pathlib import Path
import smtplib
import tempfile
import unittest

spec=importlib.util.spec_from_file_location('gateway',Path(__file__).with_name('mail_gateway.py'))
gateway=importlib.util.module_from_spec(spec)
spec.loader.exec_module(gateway)
MESSAGE={'to':'test@example.test','title':'Swim\r\nHeader','url':'https://finfolk.com.au/events/invitation?token=test'}

class MailGateway(unittest.TestCase):
    def test_persistent_receipt_prevents_duplicates_and_conflicting_keys(self):
        with tempfile.TemporaryDirectory() as directory:
            calls=[]
            path=str(Path(directory)/'state.sqlite')
            delivery=gateway.Delivery(path,calls.append)
            status, receipt=delivery.deliver('key',MESSAGE)
            self.assertEqual(status,200)
            self.assertNotIn('\n',str(calls[0]['Subject']))
            reopened=gateway.Delivery(path,calls.append)
            self.assertEqual(reopened.deliver('key',MESSAGE),(200,receipt))
            self.assertEqual(reopened.deliver('key',{**MESSAGE,'title':'Changed'})[0],409)
            self.assertEqual(len(calls),1)

    def test_uncertain_send_never_repeats_but_explicit_rejection_can_retry(self):
        for error,retry in [(TimeoutError(),False),(smtplib.SMTPDataError(451,b'Try later'),True)]:
            with self.subTest(error=type(error).__name__), tempfile.TemporaryDirectory() as directory:
                calls=[]
                def send(message):
                    calls.append(message)
                    if len(calls)==1: raise error
                delivery=gateway.Delivery(str(Path(directory)/'state.sqlite'),send)
                self.assertEqual(delivery.deliver('key',MESSAGE)[0],503)
                self.assertEqual(delivery.deliver('key',MESSAGE)[0],200 if retry else 409)
                self.assertEqual(len(calls),2 if retry else 1)

    def test_input_cannot_inject_a_recipient_or_external_link(self):
        with tempfile.TemporaryDirectory() as directory:
            calls=[]
            delivery=gateway.Delivery(str(Path(directory)/'state.sqlite'),calls.append)
            for change in [{'to':'one@example.test,two@example.test'}, {'url':'https://evil.example/events/invitation'}, {'from':'other@example.test'}]:
                self.assertEqual(delivery.deliver('key',{**MESSAGE,**change})[0],400)
            self.assertEqual(calls,[])

if __name__=='__main__': unittest.main()
